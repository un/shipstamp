import type { InitHookMode } from "./init";
import type { InstallScope } from "./scopedInstall";

export type InstallWizardChoice = {
  scope: InstallScope;
  hook: InitHookMode;
};

type ScreenChoice = {
  key: string;
  label: string;
  description: string;
};

async function waitForChoice(title: string, subtitle: string, options: ScreenChoice[]): Promise<string> {
  const { createCliRenderer, BoxRenderable, TextRenderable } = await import("@opentui/core");

  const renderer = await createCliRenderer({
    exitOnCtrlC: false
  });

  const root = new BoxRenderable(renderer, {
    id: "root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    gap: 1,
    padding: 1,
    backgroundColor: "#0b1020"
  });
  renderer.root.add(root);

  root.add(
    new TextRenderable(renderer, {
      id: "title",
      content: title,
      fg: "#a7f3d0"
    })
  );

  root.add(
    new TextRenderable(renderer, {
      id: "subtitle",
      content: subtitle,
      fg: "#93c5fd"
    })
  );

  root.add(
    new TextRenderable(renderer, {
      id: "hint",
      content: "Press number key to choose, or q/esc to cancel.",
      fg: "#94a3b8"
    })
  );

  for (const option of options) {
    root.add(
      new TextRenderable(renderer, {
        id: `opt-${option.key}`,
        content: `${option.key}) ${option.label}\n   ${option.description}`,
        fg: "#e2e8f0"
      })
    );
  }

  return await new Promise<string>((resolve, reject) => {
    let settled = false;

    const finish = (value: string, isError = false) => {
      if (settled) return;
      settled = true;
      renderer.destroy();
      if (isError) reject(new Error(value));
      else resolve(value);
    };

    renderer.keyInput.on("keypress", (key: any) => {
      const name = key?.name ?? "";
      if (name === "q" || name === "escape" || (key?.ctrl && name === "c")) {
        finish("Canceled.", true);
        return;
      }

      const matched = options.find((o) => o.key === name);
      if (matched) {
        finish(matched.key);
      }
    });
  });
}

export async function runInstallWizardTui(): Promise<InstallWizardChoice> {
  const scopeKey = await waitForChoice("GitPreflight Setup", "Choose where to enable GitPreflight:", [
    {
      key: "1",
      label: "Global (all repos)",
      description: "Developer-level opt-in for all repositories on this machine."
    },
    {
      key: "2",
      label: "Local (this repo only)",
      description: "Repo-only install in .git with no committed integration files."
    },
    {
      key: "3",
      label: "Repo (committed)",
      description: "Team-owned setup using committed Husky integration in this repository."
    }
  ]);

  const hookKey = await waitForChoice("Hook Mode", "Choose when GitPreflight runs:", [
    {
      key: "1",
      label: "pre-commit",
      description: "Review staged changes at commit time."
    },
    {
      key: "2",
      label: "pre-push",
      description: "Review pushed commit range at push time."
    },
    {
      key: "3",
      label: "both",
      description: "Install both pre-commit and pre-push flows."
    }
  ]);

  const scope: InstallScope = scopeKey === "1" ? "global" : scopeKey === "2" ? "local" : "repo";
  const hook: InitHookMode = hookKey === "1" ? "pre-commit" : hookKey === "2" ? "pre-push" : "both";

  const confirm = await waitForChoice(
    "Confirm Setup",
    `Scope: ${scope} | Hook: ${hook}\nApply these changes?`,
    [
      {
        key: "1",
        label: "Apply setup",
        description: "Write hooks/config with the selected scope and hook mode."
      },
      {
        key: "2",
        label: "Cancel",
        description: "Exit without making any changes."
      }
    ]
  );

  if (confirm !== "1") {
    throw new Error("Canceled.");
  }

  return { scope, hook };
}
