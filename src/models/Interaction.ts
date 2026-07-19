import mongoose, { Schema } from "mongoose";

const interactionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    type: { type: String, enum: ["view", "save", "inquiry", "dismiss"], required: true },
  },
  { timestamps: true }
);

export const Interaction = mongoose.model("Interaction", interactionSchema);
