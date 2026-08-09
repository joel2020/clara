import type { VisualRegistry, VisualTopicPack } from "./types";

export const CAFE_RESTAURANT_PACK: VisualTopicPack = {
  id: "cafe-restaurant",
  environment: {
    desktop: "/visual-learning/cafe-restaurant/environment-desktop.webp",
    mobile: "/visual-learning/cafe-restaurant/environment-mobile.webp",
  },
  story: {
    eyebrow: { es: "Tu misión · Café", en: "Your mission · Café" },
    title: { es: "Pide un café con confianza", en: "Order a coffee with confidence" },
    body: {
      es: "Lumi te acompaña: primero explora la escena, después escucha y pide tu café.",
      en: "Lumi is with you: explore the scene, listen, then order your coffee.",
    },
    cta: { es: "Entrar al café", en: "Enter the café" },
  },
  discoveryObjectIds: ["coffee", "menu", "table", "card"],
  entryObjectId: "coffee",
  entryPhraseItemId: "conv-cafe:3",
  objects: [
    {
      id: "table",
      label: { es: "Mesa", en: "Table" },
      pronunciation: "/ˈteɪbəl/",
      image: "/visual-learning/cafe-restaurant/objects/table.webp",
      audioItemId: "conv-cafe:1",
      alt: { es: "Una mesa de café", en: "A café table" },
    },
    {
      id: "menu",
      label: { es: "Menú", en: "Menu" },
      pronunciation: "/ˈmɛnjuː/",
      image: "/visual-learning/cafe-restaurant/objects/menu.webp",
      audioItemId: "conv-cafe:2",
      alt: { es: "Un menú de restaurante abierto", en: "An open restaurant menu" },
    },
    {
      id: "coffee",
      label: { es: "Café", en: "Coffee" },
      pronunciation: "/ˈkɔːfi/",
      image: "/visual-learning/cafe-restaurant/objects/coffee.webp",
      audioItemId: "conv-cafe:3",
      alt: { es: "Una taza de café", en: "A cup of coffee" },
    },
    {
      id: "chicken",
      label: { es: "Pollo", en: "Chicken" },
      pronunciation: "/ˈtʃɪkɪn/",
      image: "/visual-learning/cafe-restaurant/objects/chicken.webp",
      audioItemId: "conv-cafe:4",
      alt: { es: "Un plato de pollo", en: "A plate of chicken" },
    },
    {
      id: "onion",
      label: { es: "Cebolla", en: "Onion" },
      pronunciation: "/ˈʌnjən/",
      image: "/visual-learning/cafe-restaurant/objects/onion.webp",
      audioItemId: "conv-cafe:5",
      alt: { es: "Una cebolla cortada", en: "A sliced onion" },
    },
    {
      id: "meal",
      label: { es: "Comida", en: "Meal" },
      pronunciation: "/miːl/",
      image: "/visual-learning/cafe-restaurant/objects/meal.webp",
      audioItemId: "conv-cafe:6",
      alt: { es: "Un plato de comida", en: "A plated meal" },
    },
    {
      id: "check",
      label: { es: "La cuenta", en: "Check" },
      pronunciation: "/tʃɛk/",
      image: "/visual-learning/cafe-restaurant/objects/check.webp",
      audioItemId: "conv-cafe:7",
      alt: { es: "La cuenta del restaurante", en: "A restaurant check" },
    },
    {
      id: "card",
      label: { es: "Tarjeta", en: "Card" },
      pronunciation: "/kɑːrd/",
      image: "/visual-learning/cafe-restaurant/objects/card.webp",
      audioItemId: "conv-cafe:8",
      alt: { es: "Una tarjeta de pago", en: "A payment card" },
    },
    {
      id: "takeaway-bag",
      label: { es: "Bolsa para llevar", en: "Takeaway bag" },
      pronunciation: "/ˈteɪəweɪ bæɡ/",
      image: "/visual-learning/cafe-restaurant/objects/takeaway-bag.webp",
      audioItemId: "conv-cafe:9",
      alt: { es: "Una bolsa de comida para llevar", en: "A takeaway food bag" },
    },
    {
      id: "change",
      label: { es: "Cambio", en: "Change" },
      pronunciation: "/tʃeɪndʒ/",
      image: "/visual-learning/cafe-restaurant/objects/change.webp",
      audioItemId: "conv-cafe:10",
      alt: { es: "Monedas y billetes pequeños", en: "Coins and small bills" },
    },
  ],
  moments: {
    story: { pose: "idle", focusObjectIds: [] },
    discover: { pose: "point", focusObjectIds: ["coffee", "menu", "table", "card"] },
    speak: { pose: "think", focusObjectIds: ["coffee"] },
    success: { pose: "cheer", focusObjectIds: ["coffee"] },
    retry: { pose: "encourage", focusObjectIds: ["coffee"] },
  },
};

export const VISUAL_TOPIC_PACKS: VisualRegistry = {
  packs: {
    "cafe-restaurant": CAFE_RESTAURANT_PACK,
  },
};
