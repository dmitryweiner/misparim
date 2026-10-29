// Hebrew letters and marks, possibly several words joined by spaces.
const HEBREW_RUN = /[֐-׿]+(?:\s+[֐-׿]+)*/g;

/**
 * Wraps Hebrew fragments inside interface texts in <span lang="he" dir="rtl" class="he">.
 * Without isolation, neutral characters between two Hebrew words join them into one
 * right-to-left run, so "שני / שתי" shows as "שתי / שני" in left-to-right text.
 * The span also sets the Hebrew font and tells screen readers the language.
 * Text already inside an element with lang="he" is left alone, so it is safe to run again.
 */
export function isolateHebrew(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && !node.parentElement?.closest('[lang="he"]')) nodes.push(node);
  }
  for (const node of nodes) {
    const text = node.data;
    const matches = [...text.matchAll(HEBREW_RUN)];
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let last = 0;
    for (const match of matches) {
      fragment.append(text.slice(last, match.index));
      const span = document.createElement('span');
      span.lang = 'he';
      span.dir = 'rtl';
      span.className = 'he';
      span.textContent = match[0];
      fragment.append(span);
      last = match.index + match[0].length;
    }
    fragment.append(text.slice(last));
    node.replaceWith(fragment);
  }
}
