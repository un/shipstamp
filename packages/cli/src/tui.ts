type ParsedSummary = {
  status: "PASS" | "FAIL" | "UNCHECKED" | null;
  counts: { note: number; minor: number; major: number } | null;
};

function parseSummary(markdown: string): ParsedSummary {
  const statusMatch = markdown.match(/^Result:\s*(PASS|FAIL|UNCHECKED)\s*$/m);
  const status = (statusMatch?.[1] as any) ?? null;

  const countsMatch = markdown.match(/^Counts:\s*note=(\d+)\s+minor=(\d+)\s+major=(\d+)\s*$/m);
  const counts = countsMatch
    ? {
        note: Number(countsMatch[1]),
        minor: Number(countsMatch[2]),
        major: Number(countsMatch[3])
      }
    : null;

  return { status, counts };
}

export async function renderReviewTui(markdown: string): Promise<void> {
  const summary = parseSummary(markdown);

  const {
    createCliRenderer,
    BoxRenderable,
    TextRenderable,
    ScrollBoxRenderable,
    CodeRenderable,
    SyntaxStyle,
    RGBA
  } = await import("@opentui/core");

  const renderer = await createCliRenderer({
    exitOnCtrlC: false
  });

  const root = new BoxRenderable(renderer, {
    id: "root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    gap: 1,
    backgroundColor: "#0b1020"
  });
  renderer.root.add(root);

  const statusColor =
    summary.status === "PASS"
      ? "#10b981"
      : summary.status === "FAIL"
        ? "#ef4444"
        : summary.status === "UNCHECKED"
          ? "#f59e0b"
          : "#93c5fd";

  const header = new BoxRenderable(renderer, {
    id: "header",
    width: "100%",
    borderStyle: "rounded",
    borderColor: "#334155",
    padding: 1,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  });

  const left = new BoxRenderable(renderer, {
    id: "left",
    flexDirection: "column",
    gap: 0
  });

  left.add(
    new TextRenderable(renderer, {
      id: "title",
      content: `GitPreflight Review${summary.status ? ` · ${summary.status}` : ""}`,
      fg: statusColor
    })
  );

  left.add(
    new TextRenderable(renderer, {
      id: "subtitle",
      content: summary.counts
        ? `note=${summary.counts.note} minor=${summary.counts.minor} major=${summary.counts.major}`
        : "(counts unavailable)",
      fg: "#94a3b8"
    })
  );

  header.add(left);

  header.add(
    new TextRenderable(renderer, {
      id: "hint",
      content: "Scroll: arrows/PageUp/PageDown · Exit: q/esc/Ctrl+C",
      fg: "#64748b"
    })
  );

  root.add(header);

  const syntaxStyle = SyntaxStyle.fromStyles({
    "markup.heading": { fg: RGBA.fromHex("#93c5fd"), bold: true },
    "markup.heading.1": { fg: RGBA.fromHex("#a7f3d0"), bold: true },
    "markup.heading.2": { fg: RGBA.fromHex("#bfdbfe"), bold: true },
    "markup.bold": { fg: RGBA.fromHex("#e2e8f0"), bold: true },
    "markup.strong": { fg: RGBA.fromHex("#e2e8f0"), bold: true },
    "markup.italic": { fg: RGBA.fromHex("#e2e8f0"), italic: true },
    "markup.list": { fg: RGBA.fromHex("#fca5a5") },
    "markup.raw": { fg: RGBA.fromHex("#a5b4fc") },
    "markup.raw.block": { fg: RGBA.fromHex("#a5b4fc") },
    "markup.link": { fg: RGBA.fromHex("#60a5fa"), underline: true },
    "markup.link.url": { fg: RGBA.fromHex("#60a5fa"), underline: true },
    comment: { fg: RGBA.fromHex("#64748b"), italic: true },
    default: { fg: RGBA.fromHex("#e2e8f0") }
  });

  const code = new CodeRenderable(renderer, {
    id: "markdown",
    content: markdown,
    filetype: "markdown",
    syntaxStyle,
    width: "100%",
    selectable: true,
    selectionBg: "#1d4ed8",
    selectionFg: "#ffffff",
    conceal: false
  });

  const scroll = new ScrollBoxRenderable(renderer, {
    id: "scroll",
    width: "100%",
    height: "100%",
    scrollX: true,
    scrollY: true,
    rootOptions: {
      borderStyle: "rounded",
      borderColor: "#334155",
      backgroundColor: "#0b1020"
    },
    viewportOptions: {
      backgroundColor: "#0b1020"
    },
    contentOptions: {
      backgroundColor: "#0b1020"
    }
  });
  scroll.add(code);
  scroll.focus();

  root.add(scroll);

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    renderer.on("destroy", finish);

    renderer.keyInput.on("keypress", (key: any) => {
      if (key?.name === "q" || key?.name === "escape") {
        renderer.destroy();
        return;
      }
      if (key?.ctrl && key?.name === "c") {
        renderer.destroy();
      }
    });
  });
}
