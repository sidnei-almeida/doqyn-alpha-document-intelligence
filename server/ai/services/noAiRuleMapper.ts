import type { DocumentClassRule } from '../types/documentAi.types.js';
import type { MongoDocumentClass, MongoDocumentRule } from '../../db/types.js';

export function mapMongoToDocumentClassRule(
  docClass: MongoDocumentClass,
  rule: MongoDocumentRule,
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
