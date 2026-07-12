import { $, type QwikJSX, component$, useSignal } from "@builder.io/qwik";

const codeContentCache = new Map<string, Promise<string>>();

interface ArticleCodeDrawerProps {
  label: string;
  src: string;
}

async function getCodeContent(src: string): Promise<string> {
  let content = codeContentCache.get(src);

  if (typeof content === "undefined") {
    const response = await fetch(src);

    if (!response.ok) {
      throw new Error(`Code block request failed with ${response.status}.`);
    }

    content = Promise.resolve(response.text());
    codeContentCache.set(src, content);
  }

  return content;
}

export const ArticleCodeDrawer = component$(
  ({ label, src }: ArticleCodeDrawerProps): QwikJSX.Element => {
    const content = useSignal<string>();

    const loadContent = $(async (): Promise<void> => {
      content.value ??= await getCodeContent(src);
    });

    return (
      <details
        class="article-code-drawer"
        onFocus$={loadContent}
        onMouseOver$={loadContent}
        onToggle$={async (event): Promise<void> => {
          if ((event.target as HTMLDetailsElement).open) {
            await loadContent();
          }
        }}
      >
        <summary>{label}</summary>
        {typeof content.value === "string" && (
          <div class="article-code-drawer-content" dangerouslySetInnerHTML={content.value} />
        )}
      </details>
    );
  },
);
