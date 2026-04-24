import { z } from 'zod'

export const ExtractedProductSchema = z.object({
  product_name: z.string().min(1).nullable(),
  brand:        z.string().min(1).nullable(),
  collection:   z.string().min(1).nullable(),
  finishes:     z.array(z.string().min(1)).nullable(),
  sku:          z.string().min(1).nullable(),
  dimensions:   z.record(z.string(), z.string()).nullable(),
  image_url:    z.string().url().nullable(),
})

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>
