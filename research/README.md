# Research page structure

- `index.html` assembles the research page.
- `publications/` contains Markdown publication lists loaded by `script.js`.
- `assets/` contains code shared by the research page, such as the paper graph.
- `projects/` contains one directory per interactive research project.

## Adding an interactive project

1. Create `projects/<project-name>/`.
2. Keep project-specific scripts, equations, and other assets inside that directory.
3. Add the project markup to `index.html` with a unique `data-*` root attribute.
4. Query elements from that root in the project script so projects remain isolated.
5. Add the script near the end of `index.html` and increment its cache version after changes.

Research-page styles currently live together in the research section of the root
`style.css`, keeping the site's shared responsive rules and color variables available.
