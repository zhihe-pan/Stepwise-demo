/** 去掉已闭合的围栏代码块，便于在块外统计 ** 等分隔符（流式/残缺围栏时仅为近似）。 */
function stripClosedFencedCodeBlocks(src: string): string {
  return src.replace(/```[\s\S]*?```/g, "")
}

function balanceTripleBacktickFences(src: string): string {
  const n = (src.match(/```/g) || []).length
  if (n % 2 === 0) return src
  return `${src}\n\`\`\``
}

function balanceDoubleAsteriskBold(src: string): string {
  const bare = stripClosedFencedCodeBlocks(src)
  const matches = bare.match(/\*\*/g)
  if (!matches || matches.length % 2 === 0) return src
  return `${src}**`
}

function balanceDoubleUnderscoreBold(src: string): string {
  const bare = stripClosedFencedCodeBlocks(src)
  const matches = bare.match(/__/g)
  if (!matches || matches.length % 2 === 0) return src
  return `${src}__`
}

/**
 * 列表紧贴上一段时没有空行时 CommonMark 不认列表；模型常会写成「…说明\n- 第一项」。
 */
function ensureBlankLineBeforeLists(src: string): string {
  return src.replace(/([^\n])\n([ \t]*(?:[-*]|\d{1,2}\.) )/g, "$1\n\n$2")
}

export type PreprocessChatMarkdownOptions = {
  /** 流式生成中：临时补上未闭合的围栏/粗体标记，减轻半段语法不重排的问题 */
  balanceIncomplete?: boolean
}

/**
 * 规范化模型输出的 Markdown，再交给 react-markdown 渲染。
 */
export function preprocessChatMarkdown(
  src: string,
  options: PreprocessChatMarkdownOptions = {},
): string {
  let out = src.replace(/\r\n/g, "\n")
  out = ensureBlankLineBeforeLists(out)
  if (options.balanceIncomplete) {
    out = balanceTripleBacktickFences(out)
    out = balanceDoubleAsteriskBold(out)
    out = balanceDoubleUnderscoreBold(out)
  }
  return out
}
