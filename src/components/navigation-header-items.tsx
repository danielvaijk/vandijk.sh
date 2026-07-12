import { type QwikJSX, component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderItems = component$(
  (): QwikJSX.Element => (
    <nav>
      <ul>
        <li>
          <Link href="/blog/" prefetch>
            Articles
          </Link>
        </li>
        <li>
          <Link target="_blank" rel="noopener noreferrer" href="https://github.com/danielvaijk">
            GitHub
          </Link>
        </li>
        <li>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.linkedin.com/in/danielvaijk/"
          >
            LinkedIn
          </Link>
        </li>
      </ul>
    </nav>
  ),
);
