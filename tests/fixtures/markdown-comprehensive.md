---
title: Maploom rendering acceptance fixture
---

# Maploom acceptance test

A paragraph with **bold**, *italic*, ~~strike~~, `inline code`, and a [link](https://example.com).

## Branches and lists

- First branch
  - Nested item
  - [x] Completed task
  - [ ] Incomplete task
- Second branch

## Links, formatting and images

A paragraph with **bold**, *italic*, ~~strikethrough~~, `inline code`, and a [test link to OpenAI](https://openai.com).

The image below is a local SVG asset stored beside this fixture.

![Maploom local image fixture](maploom-fixture.svg)

## Tables

The table must appear as a formatted grid in the Maploom graph and as a semantic table in the Source note modal.

| Provision | Subject | Status |
|:--|:--:|--:|
| Article 14 | Equality | **Core** |
| Article 19 | Freedoms | Reviewed |
| Article 21 | Life and liberty | Pending |

## Code

```ts
const maploom = 'Markdown in, mind map out';
console.log(maploom);
```

## Blockquote

> A blockquote should remain attached to its owning branch as note content.

## Mathematics

Euler identity: $e^{i\pi} + 1 = 0$.
