import {z} from 'zod';

export const locales = ['ru', 'en'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'ru';
export const localeSchema = z.enum(locales);
export const modelSchema = z.object({id:z.string().min(1).max(128), sourceId:z.string().min(1).max(128), makeId:z.string().min(1).max(128), label:z.string().max(500),makeLabel:z.string().optional(),kind:z.enum(['car','motorcycle']).optional()});
export type VehicleModel = z.infer<typeof modelSchema>;
export const modelListSchema = z.object({data:z.array(modelSchema).max(1000), status:z.enum(['empty', 'ready'])});
export const favoriteSchema = z.object({version:z.literal(1), modelIds:z.array(z.string().min(1).max(128)).max(100)});
export const favoritesKey = 'selection-auto-parts:favorite-models:v1';
export function parseFavorites(value: string | null): string[] {
  try { const parsed = favoriteSchema.safeParse(JSON.parse(value ?? 'null')); return parsed.success ? [...new Set(parsed.data.modelIds)] : []; } catch { return []; }
}
export function toggleFavorite(ids: string[], id: string): string[] {
  if (!modelSchema.shape.id.safeParse(id).success) return ids;
  return ids.includes(id) ? ids.filter(value => value !== id) : [...new Set([...ids, id])].slice(0, 100);
}
export function localizedLabel(labels: Partial<Record<Locale, string>>, locale: Locale, original: string): string {
  return labels[locale] || labels[defaultLocale] || original;
}
const idSchema=z.string().min(1).max(128);
export const kindSchema=z.enum(['car','motorcycle']);
export const modelsQuerySchema = z.object({locale:localeSchema.default('ru'),makeId:idSchema.optional(),kind:kindSchema.optional(),ids:z.string().max(12900).transform(v=>v.split(',')).pipe(z.array(idSchema).max(100)).optional()}).strict();
export const selectionQuerySchema=z.object({locale:localeSchema.default('ru'),kind:kindSchema.default('car'),makeId:idSchema.optional(),modelId:idSchema.optional(),fuel:idSchema.optional(),body:idSchema.optional(),transmission:idSchema.optional()}).strict().refine(v=>!v.modelId||!!v.makeId).refine(v=>!(v.fuel||v.body||v.transmission)||!!v.modelId);
export type SelectionQuery=z.infer<typeof selectionQuerySchema>;
export const optionSchema=z.object({id:idSchema,label:z.string()});
export const variantSchema=z.object({id:idSchema,modelId:idSchema,label:z.string(),productionFrom:z.string().nullable(),productionTo:z.string().nullable(),powerKw:z.number().nullable(),engineCode:z.string().nullable(),fuel:z.string().nullable(),body:z.string().nullable(),transmission:z.string().nullable()});
export const selectionSchema=z.object({makes:z.array(optionSchema),models:z.array(modelSchema),fuels:z.array(z.string()),bodies:z.array(z.string()),transmissions:z.array(z.string()),variants:z.array(variantSchema),totalVariants:z.number().int().nonnegative()});
export type Selection=z.infer<typeof selectionSchema>;
export const categoriesQuerySchema=z.object({locale:localeSchema.default('ru'),variantId:idSchema}).strict();
export const categorySchema=optionSchema.extend({parentId:idSchema.nullable(),hasParts:z.boolean()});
export const categoriesSchema=z.object({data:z.array(categorySchema),status:z.enum(['ready','empty'])});
export const partsQuerySchema=categoriesQuerySchema.extend({categoryId:idSchema,page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(50).default(20)}).strict();
export const displayAttributeSchema=z.object({title:z.string(),value:z.string()});
export const fitmentGroupSchema=z.object({general:z.array(displayAttributeSchema),alternatives:z.array(z.array(displayAttributeSchema)),information:z.array(z.string())});
export const oeReferenceSchema=z.object({manufacturer:z.string(),number:z.string(),information:z.string(),additive:z.boolean()});
export const crossReferenceSchema=z.object({brand:z.string(),number:z.string(),type:z.enum(['replaces','replaced_by'])});
export const referencesQuerySchema=z.object({locale:localeSchema.default('ru'),partId:idSchema,kind:z.enum(['oe','crosses']),page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)}).strict();
export const referencesResultSchema=z.object({oe:z.array(oeReferenceSchema),crosses:z.array(crossReferenceSchema),total:z.number().int().nonnegative(),page:z.number().int(),limit:z.number().int()});
export type ReferencesQuery=z.infer<typeof referencesQuerySchema>;
export type ReferencesResult=z.infer<typeof referencesResultSchema>;
export const partResultSchema=z.object({id:z.string(),brand:z.string(),number:z.string(),label:z.string(),oe:z.array(oeReferenceSchema),crosses:z.array(crossReferenceSchema),oeTotal:z.number().int().nonnegative().optional(),crossesTotal:z.number().int().nonnegative().optional(),conditions:z.array(displayAttributeSchema),fitmentGroups:z.array(fitmentGroupSchema)});
export const partsResultSchema=z.object({data:z.array(partResultSchema),total:z.number().int().nonnegative(),page:z.number(),limit:z.number()});
export type PartResults=z.infer<typeof partsResultSchema>;
export const emptySelection:Selection={makes:[],models:[],fuels:[],bodies:[],transmissions:[],variants:[],totalVariants:0};
