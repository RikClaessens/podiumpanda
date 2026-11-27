export type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const tokenPattern =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const attributePattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function decode(text: string) {
  return text.replace(/&(#x?[0-9a-fA-F]+|lt|gt|amp|quot|apos);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[entity] ?? match;
  });
}

// Small dependency-free XML reader, enough for MusicXML and MuseScore files.
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  for (const match of source.matchAll(tokenPattern)) {
    const [, cdata, closing, opening, rawAttributes, selfClosing, text] = match;
    const current = stack[stack.length - 1];
    if (cdata !== undefined) current.text += cdata;
    else if (text !== undefined) current.text += decode(text);
    else if (closing !== undefined) {
      if (stack.length < 2 || current.name !== closing) throw new Error("Invalid XML.");
      stack.pop();
    } else if (opening !== undefined) {
      const attrs: Record<string, string> = {};
      for (const attribute of (rawAttributes ?? "").matchAll(attributePattern))
        attrs[attribute[1]] = decode(attribute[2] ?? attribute[3] ?? "");
      const node: XmlNode = { name: opening, attrs, children: [], text: "" };
      current.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  if (stack.length !== 1 || !root.children.length) throw new Error("Invalid XML.");
  return root.children[0];
}

export const child = (node: XmlNode, name: string) =>
  node.children.find((item) => item.name === name);
export const childrenNamed = (node: XmlNode, name: string) =>
  node.children.filter((item) => item.name === name);
export const childText = (node: XmlNode, name: string) => child(node, name)?.text.trim();
export function descendants(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap((item) => [
    ...(item.name === name ? [item] : []),
    ...descendants(item, name),
  ]);
}
