import {ProductResponse} from './types/index.js';

export const seedProducts: Partial<ProductResponse>[] = [
    {
        id: '1',
        slug: 'farm-fresh-yellow-kernels',
        title: 'Farm‑fresh Yellow Kernels',
        subtitle: 'Classic movie‑night perfection',
        price: 5.99,
        rating: 4.5,
        ratingCount: 214,
        tags: ['Best Seller'],
        images: ['https://www.westcoastseeds.com/cdn/shop/files/CN374_CaramelPopcorn_2015_STOCK_R400MR_4.jpg?crop=center&height=1024&v=1708444445&width=1024',
            'https://upload.wikimedia.org/wikipedia/commons/d/d6/Popcorn_-_Studio_-_2011.jpg',
            'https://growhoss.com/cdn/shop/products/south-american-popcorn_460x@2x.jpg?v=1691783141',],
        options: {
            size: {
                name: 'Size',
                values: [
                    {id: '1lb', label: '1 lb'},
                    {id: '2lb', label: '2 lb'},
                    {id: '5lb', label: '5 lb'},
                ],
            },
        },
        description:
            "Meet our farm‑fresh yellow kernels—bright, fluffy, and ready to pop. Grown with care and packaged at peak freshness for the perfect bowl every time.",
        details: [
            'Ingredients: 100% Yellow Popcorn Kernels',
            'Allergens: Packaged in a facility that also handles dairy and soy.',
            'Storage: Store in a cool, dry place. Reseal after opening.',
        ],
        specs: {
            'Origin': 'Local family farm',
            'Net weight': '1 lb (454 g)',
            'Best by': '12 months from pack date',
        },
        badges: ['Non‑GMO', 'Gluten‑Free', 'Small‑Batch'],
    },
    {
        id: '2',
        slug: 'white-butterfly-popcorn',
        title: 'White Butterfly Popcorn',
        subtitle: 'Tender & light for extra crunch',
        price: 6.49,
        rating: 4.0,
        ratingCount: 134,
        tags: ['New'],
        images: ['https://altonbrown.com/wp-content/uploads/2016/04/alton-brown-kettle-corn-recipe.jpg',
            'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/G-H-Cretors-Caramel-Corn.jpg/1200px-G-H-Cretors-Caramel-Corn.jpg'],
        description: 'A delicate pop with big personality—perfect for seasonings and sweet coatings.',
        badges: ['Vegan', 'Air‑pop friendly'],
    },
    {
        id: '3',
        slug: 'caramel-drizzle-pack',
        title: 'Caramel Drizzle Pack',
        subtitle: 'Sweet, glossy, irresistible',
        price: 12.99,
        rating: 4.5,
        ratingCount: 89,
        tags: ['Limited'],
        images: ['https://www.forestwholefoods.co.uk/wp-content/uploads/2017/05/Organic-Popping-Corn-1500px.jpg'],
        description: 'Everything you need for a quick caramel upgrade at home.',
    },
];
