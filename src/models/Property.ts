import mongoose, { Schema } from "mongoose";

const propertySchema = new Schema(
  {
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true, index: true },
    division: {
      type: String,
      enum: ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["apartment", "house", "land", "commercial"],
      required: true,
      index: true,
    },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    areaSqft: { type: Number },
    images: [{ type: String }],
    ownerId: { type: String, required: true, index: true }, // Better Auth user id
    ownerName: { type: String, required: true },
    tags: [{ type: String }],
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

propertySchema.index({ title: "text", location: "text" });

export const Property = mongoose.model("Property", propertySchema);