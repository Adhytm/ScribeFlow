import assert from 'node:assert/strict';
import { parseSections, sectionsToHtml } from '../src/services/llm.ts';

console.log('--- 测试 1: parseSections 与 sectionsToHtml 健壮性测试 ---');

// 场景 1: 模型返回纯文本，完全没有 ### 标题
const plainText = '这是一段完全没有带 Markdown 标题的纯文本促销文案。\n第二行继续写具体卖点。';
const plainSections = parseSections(plainText);
assert.equal(plainSections.length, 1, '纯文本应被归为单段');
assert.equal(plainSections[0].title, '');
assert.ok(plainSections[0].body.includes('第二行继续写具体卖点'));

const plainHtml = sectionsToHtml(plainSections);
assert.ok(plainHtml.includes('<p>这是一段完全没有带 Markdown 标题的纯文本促销文案。</p>'), '应正常渲染段落');
assert.ok(plainHtml.includes('<p>第二行继续写具体卖点。</p>'), '第二行应渲染为段落');
assert.ok(!plainHtml.includes('<h2>'), '纯文本不应凭空捏造 h2 标题');
console.log('✓ 纯文本输出容错通过（彻底避免正文变白板）');

// 场景 2: 前置引言 + ### 分段
const mixedText = '好的，这是为您撰写的文案：\n### 开头钩子\n你是不是也经常觉得洗脸拔干？\n\n### 痛点放大\n加班到深夜，脸又油又干。';
const mixedSections = parseSections(mixedText);
assert.equal(mixedSections.length, 3, '应提取前置引言 + 2个带标题的分段');
assert.equal(mixedSections[0].title, '');
assert.equal(mixedSections[0].body, '好的，这是为您撰写的文案：');
assert.equal(mixedSections[1].title, '开头钩子');
assert.ok(mixedSections[1].body.includes('洗脸拔干'));
assert.equal(mixedSections[2].title, '痛点放大');
assert.ok(mixedSections[2].body.includes('加班到深夜'));

const mixedHtml = sectionsToHtml(mixedSections);
assert.ok(mixedHtml.includes('<p>好的，这是为您撰写的文案：</p>'), '前置引言保留');
assert.ok(mixedHtml.includes('<h2>开头钩子</h2>'), '第一段标题保留');
assert.ok(mixedHtml.includes('<h2>痛点放大</h2>'), '第二段标题保留');
console.log('✓ 前置引言 + 标题分段混合解析通过');

// 场景 3: 流式阶段只有标题（body 为空）
const streamHeaderOnly = '### 核心卖点登场\n';
const streamSections = parseSections(streamHeaderOnly);
assert.equal(streamSections.length, 1);
assert.equal(streamSections[0].title, '核心卖点登场');
assert.equal(streamSections[0].body, '');

const streamHtml = sectionsToHtml(streamSections);
assert.ok(streamHtml.includes('<h2>核心卖点登场</h2>'), '流式只输出标题时应立即渲染 h2 占位，绝不能吞没变白板');
console.log('✓ 流式标题占位渲染通过');

// 场景 4: 空文本
assert.equal(sectionsToHtml(parseSections('')), '');
assert.equal(sectionsToHtml(parseSections('   ')), '');
console.log('✓ 空文本安全兜底通过');

console.log('\n========================================');
console.log('全部 4 组前端核心健壮性单元测试 PASS！');
console.log('========================================');
