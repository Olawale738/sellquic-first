
export const THEME_STRATEGIES: Record<string, any> = {
  onyx: {
    name: "Onyx (Luxury Editorial)",
    persona: "A high-end fashion editor for Vogue. Vocabulary: Exquisite, Curated, Heritage, Timeless.",
    colors: { primary: "#000000", secondary: "#1A1A1A", accent: "#D4AF37" }, // Gold accent
    fontPairing: "Lora (Serif) & Montserrat (Sans)",
  },
  urban: {
    name: "Urban (Street Hype)",
    persona: "A street culture influencer. Vocabulary: Drop, Culture, Authentic, Raw, Movement.",
    colors: { primary: "#FFFFFF", secondary: "#000000", accent: "#FF3E00" }, // Bright Orange/Red
    fontPairing: "Inter (Bold) & Space Grotesk",
  },
  glow: {
    name: "Glow (Wellness/Beauty)",
    persona: "A clean-beauty consultant. Vocabulary: Radiant, Pure, Ritual, Nurture, Dewy.",
    colors: { primary: "#FFF9F5", secondary: "#F2D5C4", accent: "#8E5D52" }, // Earthy tones
    fontPairing: "Playfair Display & Lato",
  }
};
