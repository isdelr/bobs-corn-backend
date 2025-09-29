import { validationResult } from 'express-validator';
import { knex } from '../db.js';

function toNumber2(value) {
  const n = Number(value);
  return Math.round(n * 100) / 100;
}

function priceToCents(value) {
  return Math.round(Number(value) * 100);
}

function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}

export async function purchase(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);

    const { items, shippingAddress, saveAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    // Validate that each item has either slug or productId
    for (const [i, it] of items.entries()) {
      if (!it || typeof it !== 'object') return res.status(400).json({ error: `Item ${i} is invalid` });
      if (!('slug' in it) && !('productId' in it)) {
        return res.status(400).json({ error: `Item ${i} must include slug or productId` });
      }
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Item ${i} has invalid quantity` });
      }
    }

    const slugs = items.filter((it) => it.slug).map((it) => String(it.slug));
    const ids = items.filter((it) => it.productId).map((it) => Number(it.productId));

    // Fetch products
    const products = await knex('products')
      .modify((qb) => {
        if (slugs.length) qb.whereIn('slug', slugs);
        if (ids.length) qb.orWhereIn('id', ids);
      })
      .select('*');

    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const byId = new Map(products.map((p) => [p.id, p]));

    // Build order items snapshot
    const orderItems = [];
    for (const it of items) {
      const row = it.slug ? bySlug.get(String(it.slug)) : byId.get(Number(it.productId));
      if (!row) {
        return res.status(400).json({ error: `Product not found for ${it.slug ?? it.productId}` });
      }
      const quantity = Number(it.quantity);
      const priceCents = priceToCents(row.price);
      orderItems.push({
        product_id: row.id,
        slug: row.slug,
        title: row.title,
        price: centsToDecimalString(priceCents),
        quantity,
      });
    }
    // Rate limit: per-user per-product within a sliding time window
    // Configurable via env:
    // - PURCHASE_RATE_LIMIT_PER_PRODUCT (default 1)
    // - PURCHASE_RATE_LIMIT_WINDOW_SECONDS (default 60)
    const parsedLimit = Number.parseInt(process.env.PURCHASE_RATE_LIMIT_PER_PRODUCT ?? '', 10);
    const limitPerProduct = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 1;
    const parsedWindow = Number.parseInt(process.env.PURCHASE_RATE_LIMIT_WINDOW_SECONDS ?? '', 10);
    const windowSeconds = Number.isFinite(parsedWindow) && parsedWindow > 0 ? parsedWindow : 60;
    // Sum requested quantities by product
    const requestedQtyByProductId = new Map();
    for (const oi of orderItems) {
      requestedQtyByProductId.set(oi.product_id, (requestedQtyByProductId.get(oi.product_id) || 0) + oi.quantity);
    }
    if (requestedQtyByProductId.size) {
      const productIds = Array.from(requestedQtyByProductId.keys());
      const recentRows = await knex('order_items as oi')
        .join('orders as o', 'oi.order_id', 'o.id')
        .where('o.user_id', userId)
        .whereIn('oi.product_id', productIds)
        .whereRaw("o.created_at >= datetime('now', ?)", [`-${windowSeconds} seconds`])
        .select('oi.product_id')
        .sum({ purchased: 'oi.quantity' })
        .groupBy('oi.product_id');
      const purchasedInWindow = new Map(recentRows.map((r) => [Number(r.product_id), Number(r.purchased) || 0]));

      for (const [pid, wantQty] of requestedQtyByProductId.entries()) {
        const prevQty = purchasedInWindow.get(pid) || 0;
        if (prevQty + wantQty > limitPerProduct) {
          const offending = orderItems.find((x) => x.product_id === pid);
          return res.status(429).json({
            error: `Rate limit exceeded for product '${offending?.slug ?? String(pid)}'. Limit is ${limitPerProduct} per ${windowSeconds} seconds.`,
            limit: limitPerProduct,
            windowSeconds,
            product: {
              id: String(pid),
              slug: offending?.slug,
              requestedQuantity: wantQty,
              recentPurchasedQuantity: prevQty,
            },
          });
        }
      }
    }

    // Compute total
    const totalCents = orderItems.reduce((sum, oi) => sum + priceToCents(oi.price) * oi.quantity, 0);
    const total = centsToDecimalString(totalCents);

    // Use provided shipping address or user's saved address
    let shippingAddressToUse = null;
    if (shippingAddress && typeof shippingAddress === 'object') {
      shippingAddressToUse = shippingAddress;
    } else {
      const u = await knex('users').where({ id: userId }).first();
      if (u && u.address) {
        try { shippingAddressToUse = JSON.parse(u.address); } catch { shippingAddressToUse = null; }
      }
    }

    // Optionally save address
    if (saveAddress && shippingAddressToUse) {
      await knex('users').where({ id: userId }).update({ address: JSON.stringify(shippingAddressToUse) });
    }

    // Create order + items in transaction
    const orderId = await knex.transaction(async (trx) => {
      const [oid] = await trx('orders').insert({
        user_id: userId,
        total,
        shipping_address: shippingAddressToUse ? JSON.stringify(shippingAddressToUse) : null,
        status: 'paid',
      });
      const rows = orderItems.map((oi) => ({ ...oi, order_id: oid }));
      if (rows.length) await trx('order_items').insert(rows);
      return oid;
    });

    const response = {
      id: String(orderId),
      total: toNumber2(total),
      status: 'paid',
      createdAt: new Date().toISOString(),
      shippingAddress: shippingAddressToUse || null,
      items: orderItems.map((oi) => ({
        productId: String(oi.product_id),
        slug: oi.slug,
        title: oi.title,
        price: toNumber2(oi.price),
        quantity: oi.quantity,
      })),
    };

    return res.status(201).json({ order: response });
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);

    const orders = await knex('orders').where({ user_id: userId }).orderBy('id', 'desc');
    if (orders.length === 0) return res.json([]);

    const ids = orders.map((o) => o.id);
    const items = await knex('order_items').whereIn('order_id', ids);
    const byOrderId = new Map();
    for (const it of items) {
      if (!byOrderId.has(it.order_id)) byOrderId.set(it.order_id, []);
      byOrderId.get(it.order_id).push(it);
    }

    const result = orders.map((o) => ({
      id: String(o.id),
      total: toNumber2(o.total),
      status: o.status,
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : undefined,
      shippingAddress: o.shipping_address ? (() => { try { return JSON.parse(o.shipping_address); } catch { return null; } })() : null,
      items: (byOrderId.get(o.id) || []).map((it) => ({
        productId: String(it.product_id),
        slug: it.slug,
        title: it.title,
        price: toNumber2(it.price),
        quantity: it.quantity,
      })),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);
    const orderId = Number(req.params.id);

    const order = await knex('orders').where({ id: orderId, user_id: userId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = await knex('order_items').where({ order_id: order.id });

    const result = {
      id: String(order.id),
      total: toNumber2(order.total),
      status: order.status,
      createdAt: order.created_at ? new Date(order.created_at).toISOString() : undefined,
      shippingAddress: order.shipping_address ? (() => { try { return JSON.parse(order.shipping_address); } catch { return null; } })() : null,
      items: items.map((it) => ({
        productId: String(it.product_id),
        slug: it.slug,
        title: it.title,
        price: toNumber2(it.price),
        quantity: it.quantity,
      })),
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
}
