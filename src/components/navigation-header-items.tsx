import { type QwikJSX, component$ } from "@builder.io/qwik";

export const NavigationHeaderItems = component$(
  (): QwikJSX.Element => (
    <nav>
      <ul>
        <li>
          <a href="/blog/">Articles</a>
        </li>
        <li>
          <a target="_blank" rel="noopener noreferrer" href="https://github.com/danielvaijk">
            GitHub
          </a>
        </li>
        <li>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.linkedin.com/in/danielvaijk/"
          >
            LinkedIn
          </a>
        </li>
      </ul>
    </nav>
  ),
);
