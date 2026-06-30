import type { QwikJSX } from "@builder.io/qwik";
import { component$, useVisibleTask$ } from "@builder.io/qwik";

type GlyphTextRevealProps = {
  routeKey: string;
};

const GLYPH_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*+=-~.:;|/\\<>";
const REVEAL_DURATION_MS = 720;
const REVEAL_STAGGER_MS = 260;
const REVEAL_FRAME_RATE = 1000 / 24;
const EXCLUDED_SELECTOR = [
  "canvas",
  "code",
  "input",
  "kbd",
  "noscript",
  "option",
  "pre",
  "samp",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
  "[data-glyph-text-reveal]",
].join(",");
const revealedElements = new WeakSet<Element>();

type AnimatedGlyphToken = {
  original: string;
  overlay: HTMLSpanElement;
  startOffset: number;
};

type GlyphTextRevealTarget = {
  element: Element;
  textNodes: Text[];
};

type WrappedTextNode = {
  original: string;
  wrapper: HTMLSpanElement;
};

const randomGlyph = (): string => GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];

const shouldAnimateTextNode = (node: Text): boolean => {
  const parent = node.parentElement;

  if (!parent || parent.closest(EXCLUDED_SELECTOR)) return false;

  return node.data.trim().length > 0;
};

const createScrambledText = (text: string, progress: number): string => {
  const revealCount = Math.floor(text.length * progress);

  return Array.from(text, (character, index): string => {
    if (/\s/u.test(character)) return character;
    if (index < revealCount) return character;

    return randomGlyph();
  }).join("");
};

const createGlyphToken = (
  text: string,
): { element: HTMLSpanElement; token: AnimatedGlyphToken } => {
  const element = document.createElement("span");
  const original = document.createElement("span");
  const overlay = document.createElement("span");

  element.dataset.glyphTextReveal = "";
  element.style.position = "relative";
  element.style.display = "inline-block";
  element.style.verticalAlign = "baseline";
  element.style.lineHeight = "inherit";

  original.textContent = text;
  original.style.color = "transparent";

  overlay.textContent = createScrambledText(text, 0);
  overlay.ariaHidden = "true";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.whiteSpace = "pre";

  element.append(original, overlay);

  return {
    element,
    token: {
      original: text,
      overlay,
      startOffset: Math.random() * REVEAL_STAGGER_MS,
    },
  };
};

const createRevealTargets = (root: HTMLElement): GlyphTextRevealTarget[] => {
  const textNodesByElement = new Map<Element, Text[]>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node): number =>
      shouldAnimateTextNode(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const parent = textNode.parentElement;

    if (parent && !revealedElements.has(parent)) {
      textNodesByElement.set(parent, [...(textNodesByElement.get(parent) ?? []), textNode]);
    }

    currentNode = walker.nextNode();
  }

  return Array.from(textNodesByElement, ([element, textNodes]) => ({ element, textNodes }));
};

const animateTextNodes = (textNodes: Text[]): (() => void) => {
  const tokens: AnimatedGlyphToken[] = [];
  const wrappedTextNodes: WrappedTextNode[] = [];

  for (const textNode of textNodes) {
    if (!textNode.isConnected || !shouldAnimateTextNode(textNode)) continue;

    const original = textNode.data;
    const wrapper = document.createElement("span");
    const fragment = document.createDocumentFragment();

    wrapper.dataset.glyphTextReveal = "";

    for (const part of original.split(/(\s+)/u)) {
      if (part.length === 0) continue;

      if (/^\s+$/u.test(part)) {
        fragment.append(document.createTextNode(part));
        continue;
      }

      const { element, token } = createGlyphToken(part);
      tokens.push(token);
      fragment.append(element);
    }

    wrapper.append(fragment);
    textNode.replaceWith(wrapper);
    wrappedTextNodes.push({ original, wrapper });
  }

  if (tokens.length === 0) return (): void => {};

  let animationFrame = 0;
  let startedAt = 0;
  let lastFrameAt = 0;
  let isRestored = false;

  const restoreText = (): void => {
    if (isRestored) return;
    isRestored = true;

    for (const { original, wrapper } of wrappedTextNodes) {
      wrapper.replaceWith(document.createTextNode(original));
    }
  };

  const render = (time: number): void => {
    if (startedAt === 0) startedAt = time;

    if (time - lastFrameAt < REVEAL_FRAME_RATE) {
      animationFrame = requestAnimationFrame(render);
      return;
    }

    lastFrameAt = time;

    let isComplete = true;

    for (const { original, overlay, startOffset } of tokens) {
      const progress = Math.min(1, (time - startedAt - startOffset) / REVEAL_DURATION_MS);

      if (progress < 1) {
        isComplete = false;
        overlay.textContent = createScrambledText(original, Math.max(0, progress));
      } else {
        overlay.textContent = original;
      }
    }

    if (!isComplete) {
      animationFrame = requestAnimationFrame(render);
    } else {
      restoreText();
    }
  };

  animationFrame = requestAnimationFrame(render);

  return (): void => {
    cancelAnimationFrame(animationFrame);
    restoreText();
  };
};

export const GlyphTextReveal = component$(({ routeKey }: GlyphTextRevealProps): QwikJSX.Element => {
  useVisibleTask$(({ cleanup, track }): void => {
    track(() => routeKey);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.body;
    if (!root || prefersReducedMotion) return;

    const restoreAnimations = new Set<() => void>();
    const observer = new IntersectionObserver(
      (entries): void => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const target = entry.target as Element;
          const textNodes = targetsByElement.get(target);
          if (!textNodes) continue;

          observer.unobserve(target);
          targetsByElement.delete(target);
          revealedElements.add(target);

          const restoreAnimation = animateTextNodes(textNodes);
          restoreAnimations.add(restoreAnimation);
        }
      },
      { threshold: 0.01 },
    );
    const targets = createRevealTargets(root);
    const targetsByElement = new Map<Element, Text[]>(
      targets.map(({ element, textNodes }) => [element, textNodes]),
    );

    for (const { element } of targets) {
      observer.observe(element);
    }

    cleanup(() => {
      observer.disconnect();

      for (const restoreAnimation of restoreAnimations) {
        restoreAnimation();
      }
    });
  });

  return <></>;
});
