const products = [
    {
        id: 1,
        name: "Smart Watch Series 9",
        category: "Electronics",
        brand: "Apple",
        price: 85000,
        oldPrice: 100000,
        rating: 4.8,
        reviews: 124,
        image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop",
        description: "Premium smartwatch with fitness tracking, heart rate monitoring, GPS, and smart notification features. Water-resistant up to 50 meters.",
        stock: 25,
        colors: ["#1a1a1a", "#c0c0c0", "#ffd700"],
        sizes: [],
        isFlash: false
    },
    {
        id: 2,
        name: "Wireless Headphones",
        category: "Electronics",
        brand: "Sony",
        price: 45000,
        oldPrice: 55000,
        rating: 4.6,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
        description: "True wireless over-ear headphones with active noise cancellation, 30-hour battery life, and premium sound quality.",
        stock: 40,
        colors: ["#1a1a1a", "#1e3a8a", "#c0c0c0"],
        sizes: [],
        isFlash: true,
        flashStock: 12
    },
    {
        id: 3,
        name: "Denim Shirt",
        category: "Fashion",
        brand: "Levi's",
        price: 18500,
        oldPrice: 25000,
        rating: 4.3,
        reviews: 67,
        image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop",
        description: "Classic denim shirt with button-down collar. 100% cotton. Regular fit. Machine washable.",
        stock: 35,
        colors: ["#4a6fa5", "#1a1a1a", "#ffffff"],
        sizes: ["S", "M", "L", "XL"],
        isFlash: false
    },
    {
        id: 4,
        name: "Classic Sneakers",
        category: "Shoes",
        brand: "Nike",
        price: 32000,
        oldPrice: 40000,
        rating: 4.5,
        reviews: 210,
        image: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=400&h=400&fit=crop",
        description: "Timeless sneaker design with premium leather upper. Cushioned sole for all-day comfort. Durable rubber outsole.",
        stock: 20,
        colors: ["#ffffff", "#1a1a1a", "#c0c0c0"],
        sizes: ["40", "41", "42", "43", "44"],
        isFlash: true,
        flashStock: 8
    },
    {
        id: 5,
        name: "iPhone 15 Pro Max",
        category: "Phones",
        brand: "Apple",
        price: 1250000,
        oldPrice: 1350000,
        rating: 4.9,
        reviews: 342,
        image: "https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400&h=400&fit=crop",
        description: "Titanium design with A17 Pro chip. 48MP main camera with 5x telephoto zoom. Super Retina XDR display.",
        stock: 12,
        colors: ["#5a5a5a", "#1a1a1a", "#c0c0c0"],
        sizes: ["256GB", "512GB", "1TB"],
        isFlash: false
    },
    {
        id: 6,
        name: "MacBook Air M3",
        category: "Computers",
        brand: "Apple",
        price: 950000,
        oldPrice: 1100000,
        rating: 4.8,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop",
        description: "Supercharged by M3 chip with 8-core CPU and 10-core GPU. 15.3-inch Liquid Retina display. Up to 18 hours battery.",
        stock: 8,
        colors: ["#c0c0c0", "#1a1a1a", "#f5f5dc"],
        sizes: ["8GB/256GB", "16GB/512GB"],
        isFlash: false
    },
    {
        id: 7,
        name: "Designer Handbag",
        category: "Fashion",
        brand: "Gucci",
        price: 280000,
        oldPrice: 350000,
        rating: 4.5,
        reviews: 67,
        image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=400&fit=crop",
        description: "Genuine Italian leather handbag with gold-tone hardware. Spacious interior with multiple compartments.",
        stock: 10,
        colors: ["#8B4513", "#1a1a1a", "#c0c0c0"],
        sizes: [],
        isFlash: false
    },
    {
        id: 8,
        name: "Sony WH-1000XM5",
        category: "Electronics",
        brand: "Sony",
        price: 180000,
        oldPrice: 220000,
        rating: 4.9,
        reviews: 278,
        image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&h=400&fit=crop",
        description: "Industry-leading noise cancellation with 8 microphones. 30-hour battery life. Crystal clear hands-free calling.",
        stock: 22,
        colors: ["#1a1a1a", "#c0c0c0", "#f5f5dc"],
        sizes: [],
        isFlash: false
    },
    {
        id: 9,
        name: "Nike Air Max 270",
        category: "Shoes",
        brand: "Nike",
        price: 65000,
        oldPrice: 78000,
        rating: 4.7,
        reviews: 189,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
        description: "Iconic Air Max 270 with large Air unit for maximum cushioning. Breathable mesh upper for all-day comfort.",
        stock: 18,
        colors: ["#ff0000", "#1a1a1a", "#ffffff"],
        sizes: ["40", "41", "42", "43", "44", "45"],
        isFlash: true,
        flashStock: 6
    },
    {
        id: 10,
        name: "Samsung Galaxy S24",
        category: "Phones",
        brand: "Samsung",
        price: 850000,
        oldPrice: 950000,
        rating: 4.7,
        reviews: 198,
        image: "https://images.unsplash.com/photo-1610945265078-3858a0828671?w=400&h=400&fit=crop",
        description: "200MP camera with AI features. S Pen built-in. 6.8-inch QHD+ display. 5000mAh battery with 45W fast charging.",
        stock: 15,
        colors: ["#5a5a5a", "#1a1a1a", "#c0c0c0"],
        sizes: ["256GB", "512GB"],
        isFlash: false
    },
    {
        id: 11,
        name: "Dyson Airwrap",
        category: "Beauty",
        brand: "Dyson",
        price: 320000,
        oldPrice: 380000,
        rating: 4.6,
        reviews: 145,
        image: "https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=400&h=400&fit=crop",
        description: "Multi-styler with Coanda airflow technology. Styles and dries simultaneously without extreme heat.",
        stock: 14,
        colors: ["#c0c0c0", "#f5f5dc", "#1a1a1a"],
        sizes: [],
        isFlash: false
    },
    {
        id: 12,
        name: "Adidas Ultraboost",
        category: "Shoes",
        brand: "Adidas",
        price: 55000,
        oldPrice: 68000,
        rating: 4.5,
        reviews: 134,
        image: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=400&h=400&fit=crop",
        description: "Responsive Boost midsole for incredible energy return. Primeknit+ upper adapts to your foot.",
        stock: 30,
        colors: ["#1a1a1a", "#ffffff", "#7c5cfc"],
        sizes: ["40", "41", "42", "43", "44", "45", "46"],
        isFlash: false
    },
    {
        id: 13,
        name: "LG 55\" OLED TV",
        category: "Electronics",
        brand: "LG",
        price: 650000,
        oldPrice: 780000,
        rating: 4.8,
        reviews: 92,
        image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop",
        description: "4K OLED evo with AI-powered processor. Dolby Vision IQ and Dolby Atmos. webOS smart platform.",
        stock: 6,
        colors: ["#1a1a1a"],
        sizes: [],
        isFlash: false
    },
    {
        id: 14,
        name: "KitchenAid Mixer",
        category: "Home",
        brand: "KitchenAid",
        price: 180000,
        oldPrice: 220000,
        rating: 4.9,
        reviews: 312,
        image: "https://images.unsplash.com/photo-1594385208974-2e75f8d7bb48?w=400&h=400&fit=crop",
        description: "5-quart stainless steel bowl. 10-speed slide control. Tilt-head design for easy access.",
        stock: 20,
        colors: ["#ff6b8a", "#1a1a1a", "#c0c0c0", "#f5f5dc"],
        sizes: [],
        isFlash: true,
        flashStock: 8
    },
    {
        id: 15,
        name: "Ray-Ban Aviator",
        category: "Accessories",
        brand: "Ray-Ban",
        price: 75000,
        oldPrice: 90000,
        rating: 4.5,
        reviews: 201,
        image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop",
        description: "Classic aviator design with gold metal frame. G-15 green lenses provide natural vision. UV400 protection.",
        stock: 25,
        colors: ["#ffd700", "#c0c0c0", "#1a1a1a"],
        sizes: [],
        isFlash: false
    },
    {
        id: 16,
        name: "Rice Cooker 5L",
        category: "Home",
        brand: "Philips",
        price: 45000,
        oldPrice: 55000,
        rating: 4.4,
        reviews: 167,
        image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop",
        description: "Digital rice cooker with 12 cooking programs. Non-stick inner pot. Keep warm function up to 24 hours.",
        stock: 35,
        colors: ["#ffffff", "#1a1a1a"],
        sizes: [],
        isFlash: false
    },
    {
        id: 17,
        name: "Gaming Laptop RTX",
        category: "Computers",
        brand: "ASUS",
        price: 850000,
        oldPrice: 950000,
        rating: 4.7,
        reviews: 88,
        image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=400&fit=crop",
        description: "15.6\" 165Hz FHD display. Intel Core i7-13700H. 16GB DDR5 RAM. 1TB NVMe SSD. RGB backlit keyboard.",
        stock: 7,
        colors: ["#1a1a1a", "#c0c0c0"],
        sizes: [],
        isFlash: true,
        flashStock: 3
    },
    {
        id: 18,
        name: "Organic Skincare Set",
        category: "Beauty",
        brand: "The Ordinary",
        price: 35000,
        oldPrice: 45000,
        rating: 4.3,
        reviews: 234,
        image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop",
        description: "Complete skincare routine with cleanser, toner, serum, and moisturizer. Natural ingredients. Cruelty-free.",
        stock: 50,
        colors: [],
        sizes: [],
        isFlash: false
    },
    {
        id: 19,
        name: "Yoga Mat Premium",
        category: "Sports",
        brand: "Lululemon",
        price: 28000,
        oldPrice: 35000,
        rating: 4.6,
        reviews: 145,
        image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop",
        description: "6mm thick natural rubber mat with polyurethane top layer. Excellent grip even when sweaty.",
        stock: 28,
        colors: ["#7c5cfc", "#1a1a1a", "#ff6b8a", "#00d9a3"],
        sizes: [],
        isFlash: false
    },
    {
        id: 20,
        name: "Nike Dri-FIT T-Shirt",
        category: "Fashion",
        brand: "Nike",
        price: 15000,
        oldPrice: 20000,
        rating: 4.4,
        reviews: 312,
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
        description: "Breathable Dri-FIT technology wicks sweat away. Standard fit for relaxed comfort. 100% recycled polyester.",
        stock: 60,
        colors: ["#1a1a1a", "#ffffff", "#ff6b8a", "#7c5cfc"],
        sizes: ["S", "M", "L", "XL", "XXL"],
        isFlash: false
    },
    {
        id: 21,
        name: "Samsung 43\" Smart TV",
        category: "Electronics",
        brand: "Samsung",
        price: 280000,
        oldPrice: 320000,
        rating: 4.5,
        reviews: 156,
        image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&h=400&fit=crop",
        description: "Crystal UHD 4K with PurColor. Tizen OS with built-in apps. HDR10+ support. Slim design.",
        stock: 12,
        colors: ["#1a1a1a"],
        sizes: [],
        isFlash: false
    },
    {
        id: 22,
        name: "Running Shorts",
        category: "Fashion",
        brand: "Under Armour",
        price: 12000,
        oldPrice: 15000,
        rating: 4.3,
        reviews: 89,
        image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=400&fit=crop",
        description: "Lightweight woven fabric with built-in compression liner. Anti-odor technology. Elastic waistband.",
        stock: 45,
        colors: ["#1a1a1a", "#7c5cfc", "#ff6b8a"],
        sizes: ["S", "M", "L", "XL"],
        isFlash: false
    },
    {
        id: 23,
        name: "JBL Bluetooth Speaker",
        category: "Electronics",
        brand: "JBL",
        price: 35000,
        oldPrice: 42000,
        rating: 4.6,
        reviews: 178,
        image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop",
        description: "Portable waterproof speaker with 12-hour battery. JBL Pro Sound with deep bass. IPX7 waterproof.",
        stock: 32,
        colors: ["#1a1a1a", "#ff6b8a", "#00d9a3", "#ffd700"],
        sizes: [],
        isFlash: true,
        flashStock: 10
    },
    {
        id: 24,
        name: "Groceries Bundle",
        category: "Grocery",
        brand: "FreshMart",
        price: 25000,
        oldPrice: 30000,
        rating: 4.2,
        reviews: 67,
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop",
        description: "Essential groceries bundle including rice, beans, pasta, cooking oil, spices, and fresh vegetables.",
        stock: 100,
        colors: [],
        sizes: [],
        isFlash: false
    }
];

const categories = [
    { id: "all", name: "All", icon: "fa-th-large" },
    { id: "Fashion", name: "Fashion", icon: "fa-tshirt" },
    { id: "Electronics", name: "Electronics", icon: "fa-mobile-alt" },
    { id: "Home", name: "Home", icon: "fa-couch" },
    { id: "Beauty", name: "Beauty", icon: "fa-pump-soap" },
    { id: "Sports", name: "Sports", icon: "fa-basketball-ball" },
    { id: "Phones", name: "Phones", icon: "fa-mobile" },
    { id: "Computers", name: "Computers", icon: "fa-laptop" },
    { id: "Shoes", name: "Shoes", icon: "fa-shoe-prints" },
    { id: "Accessories", name: "Accessories", icon: "fa-glasses" },
    { id: "Grocery", name: "Grocery", icon: "fa-shopping-basket" }
];

function formatPrice(price) {
    return "&#8358;" + price.toLocaleString("en-NG");
}

function getDiscountPercent(oldPrice, price) {
    return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function getProductById(id) {
    return products.find(p => p.id === parseInt(id));
}

function getProductsByCategory(category) {
    if (category === "all" || category === "All") return products;
    return products.filter(p => p.category === category);
}

function searchProducts(query) {
    const q = query.toLowerCase();
    return products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
    );
}

function getFlashProducts() {
    return products.filter(p => p.isFlash);
}

function getRelatedProducts(productId, limit = 6) {
    const product = getProductById(productId);
    if (!product) return [];
    return products
        .filter(p => p.id !== productId && p.category === product.category)
        .slice(0, limit);
}
