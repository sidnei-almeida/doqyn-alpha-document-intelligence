import type { DocumentClassRule } from '../types/documentAi.types.js';
import type {
  MongoDocumentCategory,
  MongoDocumentClass,
  MongoDocumentExtractionRule,
  MongoDocumentRule,
} from '../../db/types.js';

type CategoryLike = MongoDocumentClass | MongoDocumentCategory;
type RuleLike = MongoDocumentRule | MongoDocumentExtractionRule;

export function mapMongoToDocumentClassRule(
  docClass: CategoryLike,
  rule: RuleLike,
): DocumentClassRule {
  return {
    id: docClass._id,
    name: docClass.name,
    description: docClass.description,
    keywords: docClass.keywords,
    negativeKeywords: docClass.negativeKeywords,
    fields: rule.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description,
      aliases: field.aliases,
      examples: field.examples,
    })),
    namingTemplate: rule.namingTemplate,
  };
}
