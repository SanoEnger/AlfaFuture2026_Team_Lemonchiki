"""Generate schema types from the checked-in FastAPI OpenAPI, without network tools."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
document = json.loads((root / 'backend/openapi.json').read_text(encoding='utf-8'))


def ts(schema):
    if '$ref' in schema:
        return 'ApiSchemas[' + json.dumps(schema['$ref'].split('/')[-1]) + ']'
    if 'enum' in schema:
        return ' | '.join(json.dumps(value, ensure_ascii=False) for value in schema['enum'])
    for union in ('anyOf', 'oneOf'):
        if union in schema:
            return '(' + ' | '.join(ts(item) for item in schema[union]) + ')'
    kind = schema.get('type')
    if kind == 'array':
        return 'Array<' + ts(schema.get('items', {})) + '>'
    if kind == 'object' or 'properties' in schema:
        props = schema.get('properties', {})
        if not props:
            return 'Record<string, unknown>'
        required = schema.get('required', [])
        return '{ ' + '; '.join(json.dumps(name) + ('' if name in required else '?') + ': ' + ts(value) for name, value in props.items()) + ' }'
    return {'integer': 'number', 'number': 'number', 'string': 'string', 'boolean': 'boolean', 'null': 'null'}.get(kind, 'unknown')


lines = ['// Generated from backend/openapi.json. Run npm.cmd run generate:api; do not edit.', 'export interface ApiSchemas {']
for name, schema in sorted(document['components']['schemas'].items()):
    lines.append('  ' + json.dumps(name) + ': ' + ts(schema) + ';')
lines.append('}')
out = root / 'frontend/shared/api/generated.ts'
out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Generated {len(document["components"]["schemas"])} API schemas')
