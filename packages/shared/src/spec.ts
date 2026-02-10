import { z } from "zod";

/**
 * NOTE:
 * - Coordinates are px, origin at top-left of the screenshot/canvas.
 * - Keep this schema SMALL at first; iterate once the pipeline works.
 */

export const ColorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1).optional()
});

export type RGBA = z.infer<typeof ColorSchema>;

export type NodeBase = {
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
};

export const NodeBaseSchema = z.object({
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  opacity: z.number().min(0).max(1).optional()
});

export type RectNode = NodeBase & {
  type: "rect";
  fill?: RGBA;
  stroke?: RGBA;
  strokeWidth?: number;
  cornerRadius?: number;
};

export const RectNodeSchema = NodeBaseSchema.extend({
  type: z.literal("rect"),
  fill: ColorSchema.optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().min(0).optional(),
  cornerRadius: z.number().min(0).optional()
});

export type TextNode = NodeBase & {
  type: "text";
  text: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  fill?: RGBA;
  alignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
};

export const TextNodeSchema = NodeBaseSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  fontFamily: z.string().optional(),
  fontStyle: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fill: ColorSchema.optional(),
  alignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional()
});

export type FramePadding = { top?: number; right?: number; bottom?: number; left?: number };

export type FrameNode = NodeBase & {
  type: "frame";
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  padding?: FramePadding;
  itemSpacing?: number;
  fill?: RGBA;
  stroke?: RGBA;
  strokeWidth?: number;
  cornerRadius?: number;
  children?: DesignNode[];
};

export type EllipseNode = NodeBase & {
  type: "ellipse";
  fill?: RGBA;
  stroke?: RGBA;
  strokeWidth?: number;
};

export type ImageNode = NodeBase & {
  type: "image";
  imageUrl?: string;
  imageDataUrl?: string;
  scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
  cornerRadius?: number;
  stroke?: RGBA;
  strokeWidth?: number;
};

export type DesignNode = RectNode | TextNode | FrameNode | EllipseNode | ImageNode;

export const FrameNodeSchema: z.ZodType<FrameNode> = NodeBaseSchema.extend({
  type: z.literal("frame"),
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).default("NONE"),
  padding: z
    .object({
      top: z.number().min(0).optional(),
      right: z.number().min(0).optional(),
      bottom: z.number().min(0).optional(),
      left: z.number().min(0).optional()
    })
    .optional(),
  itemSpacing: z.number().min(0).optional(),
  fill: ColorSchema.optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().min(0).optional(),
  cornerRadius: z.number().min(0).optional(),
  children: z.array(z.lazy(() => DesignNodeSchema)).default([])
}) as z.ZodType<FrameNode>;

export const EllipseNodeSchema = NodeBaseSchema.extend({
  type: z.literal("ellipse"),
  fill: ColorSchema.optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().min(0).optional()
});

export const ImageNodeSchema = NodeBaseSchema.extend({
  type: z.literal("image"),
  imageUrl: z.string().min(1).optional(),
  imageDataUrl: z.string().startsWith("data:image/").optional(),
  scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
  cornerRadius: z.number().min(0).optional(),
  stroke: ColorSchema.optional(),
  strokeWidth: z.number().min(0).optional()
}).refine((v) => Boolean(v.imageUrl || v.imageDataUrl), {
  message: "imageUrl or imageDataUrl is required"
});

export const DesignNodeSchema: z.ZodType<DesignNode> = z.lazy(
  () => z.union([RectNodeSchema, TextNodeSchema, FrameNodeSchema, EllipseNodeSchema, ImageNodeSchema])
);

export const DesignSpecSchema = z.object({
  canvas: z.object({
    name: z.string().default("Generated from Image"),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  nodes: z.array(DesignNodeSchema).default([])
});

export type DesignSpec = z.infer<typeof DesignSpecSchema>;
