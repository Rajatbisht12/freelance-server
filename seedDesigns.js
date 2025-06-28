const mongoose = require('mongoose');
const Design = require('./models/Design');
require('dotenv').config();

// Replace with a valid user ObjectId from your database (admin or any user)
const AUTHOR_ID = '685ecaa68cff147927c842c0'; // <-- Your real user ID

const dummyDesigns = [
  {
    title: 'Modern Villa 2D Plan',
    description: 'A beautiful modern villa 2D floor plan with open living spaces and a pool.',
    category: 'residential',
    style: 'modern',
    price: 199,
    currency: 'USD',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
        alt: 'Modern Villa 2D Plan',
        isPrimary: true
      }
    ],
    specifications: {
      dimensions: { width: 20, height: 10, depth: 0, unit: 'meters' },
      materials: ['concrete', 'glass'],
      colors: ['white', 'gray'],
      features: ['pool', 'open living']
    },
    tags: ['villa', '2d', 'modern'],
    status: 'published',
    isFeatured: true,
    author: AUTHOR_ID,
    license: 'personal',
    usageRights: 'Single use license',
    relatedDesigns: []
  },
  {
    title: 'Contemporary Office 3D Model',
    description: 'A 3D model of a contemporary office space, perfect for commercial projects.',
    category: 'commercial',
    style: 'contemporary',
    price: 299,
    currency: 'USD',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=600&q=80',
        alt: 'Contemporary Office',
        isPrimary: true
      }
    ],
    model3d: {
      file: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb',
      format: 'glb',
      size: 0,
      previewUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/screenshot/screenshot.png'
    },
    specifications: {
      dimensions: { width: 30, height: 15, depth: 20, unit: 'meters' },
      materials: ['glass', 'steel'],
      colors: ['blue', 'gray'],
      features: ['open workspace', 'meeting rooms']
    },
    tags: ['office', '3d', 'contemporary'],
    status: 'published',
    isFeatured: true,
    author: AUTHOR_ID,
    license: 'commercial',
    usageRights: 'Commercial use license',
    relatedDesigns: []
  },
  {
    title: 'Minimalist Apartment 2D Plan',
    description: 'A clean and minimalist apartment layout, ideal for urban living.',
    category: 'residential',
    style: 'minimalist',
    price: 99,
    currency: 'USD',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=600&q=80',
        alt: 'Minimalist Apartment 2D Plan',
        isPrimary: true
      }
    ],
    specifications: {
      dimensions: { width: 10, height: 8, depth: 0, unit: 'meters' },
      materials: ['wood', 'concrete'],
      colors: ['white', 'beige'],
      features: ['balcony', 'open kitchen']
    },
    tags: ['apartment', '2d', 'minimalist'],
    status: 'published',
    isFeatured: false,
    author: AUTHOR_ID,
    license: 'personal',
    usageRights: 'Single use license',
    relatedDesigns: []
  },
  {
    title: '3D Pavilion Model',
    description: 'A detailed 3D model of a pavilion, suitable for landscape and event projects.',
    category: 'landscape',
    style: 'modern',
    price: 149,
    currency: 'USD',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
        alt: '3D Pavilion',
        isPrimary: true
      }
    ],
    model3d: {
      file: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
      format: 'glb',
      size: 0,
      previewUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/screenshot/screenshot.png'
    },
    specifications: {
      dimensions: { width: 12, height: 6, depth: 12, unit: 'meters' },
      materials: ['wood', 'glass'],
      colors: ['brown', 'transparent'],
      features: ['open structure', 'event space']
    },
    tags: ['pavilion', '3d', 'landscape'],
    status: 'published',
    isFeatured: false,
    author: AUTHOR_ID,
    license: 'commercial',
    usageRights: 'Commercial use license',
    relatedDesigns: []
  },
  {
    title: 'Modern 3D House Model',
    description: 'A realistic 3D model of a modern house, suitable for architectural visualization.',
    category: 'residential',
    style: 'modern',
    price: 399,
    currency: 'USD',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
        alt: 'Modern 3D House',
        isPrimary: true
      }
    ],
    model3d: {
      file: '/assets/forest-house.glb',
      format: 'glb',
      size: 0,
      previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
      cloudinaryUrl: 'https://demo.dimensions.cloudinary.com/share/index.html?d=eyJuYW1lIjoiZm9yZXN0LWhvdXNlX29td2tvMyIsInNrdSI6ImZvcmVzdC1ob3VzZV9vbXdrbzMtMjgtNi0yMDI1IiwicHJlc2V0IjoiZm9yZXN0LWhvdXNlb213a28zLTE3NTEwOTM1NTYyMjctcHJlc2V0IiwiY2xvdWROYW1lIjoiZG5sZ2F6eDR2IiwiaW1hZ2VUZW1wbGF0ZXMiOltdLCJ2aWRlb1RlbXBsYXRlcyI6W10sInNwaW5zZXRUZW1wbGF0ZXMiOltdLCJoYXNUaHJlZUQiOnRydWUsImVudmlyb25tZW50IjoicHJvZHVjdGlvbiJ9',
      cloudinaryAssetId: 'forest-house_omwko3-28-6-2025',
      cloudinaryCloudName: 'dnlgazx4v'
    },
    specifications: {
      dimensions: { width: 25, height: 12, depth: 18, unit: 'meters' },
      materials: ['brick', 'glass', 'wood'],
      colors: ['white', 'brown', 'gray'],
      features: ['garage', 'balcony', 'garden']
    },
    tags: ['house', '3d', 'modern', 'residential'],
    status: 'published',
    isFeatured: true,
    author: AUTHOR_ID,
    license: 'commercial',
    usageRights: 'Commercial use license',
    relatedDesigns: []
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to MongoDB');

  // Remove old dummy designs (optional)
  // await Design.deleteMany({ title: { $in: dummyDesigns.map(d => d.title) } });

  // Insert new dummy designs
  for (const design of dummyDesigns) {
    // Only insert if not already present
    const exists = await Design.findOne({ title: design.title });
    if (!exists) {
      await Design.create(design);
      console.log(`Inserted: ${design.title}`);
    } else {
      console.log(`Already exists: ${design.title}`);
    }
  }
  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch(console.error); 