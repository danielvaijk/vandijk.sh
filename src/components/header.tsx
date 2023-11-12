import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const Header = component$(() => {
  return (
    <header>
      <div id="header-name">
        <img src="/favicon.ico" width="60" height="60" />
        <h2>aniel van Dijk</h2>
      </div>

      <nav>
        <ul>
          <li>
            <Link href="/">Portfolio</Link>
          </li>
          <li>
            <Link href="/articles">Articles</Link>
          </li>
          <li>
            <Link href="/resume">Resume</Link>
          </li>
          <li>
            <Link href="/contact">Contact</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
});
