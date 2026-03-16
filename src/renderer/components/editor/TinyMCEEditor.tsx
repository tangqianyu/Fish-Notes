import { useRef, useCallback, useMemo } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditorInstance } from "tinymce";
import { useTheme } from "../../contexts/ThemeContext";
import { scheduleHashtagDetection } from "./hashtagDetector";

interface TinyMCEEditorProps {
	defaultValue: string;
	onChange?: (html: string) => void;
}

// Theme-specific content styles injected into the editor iframe
const THEME_CONTENT_STYLES: Record<string, string> = {
	light: `
    body { background: #ffffff; color: #111827; }
    .hashtag { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; font-size: 0.9em; }
  `,
	dark: `
    body { background: #1a1a2e; color: #e2e8f0; }
    .hashtag { background-color: rgba(96, 165, 250, 0.15); color: #60a5fa; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; font-size: 0.9em; }
  `,
	solarized: `
    body { background: #fdf6e3; color: #073642; }
    .hashtag { background-color: rgba(38, 139, 210, 0.12); color: #268bd2; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; font-size: 0.9em; }
  `,
	anime: `
    body { background: #fef5f8; color: #2d1b30; }
    .hashtag { background-color: rgba(232, 67, 147, 0.1); color: #e84393; padding: 0.1em 0.4em; border-radius: 0.375rem; font-weight: 500; font-size: 0.9em; }
  `,
};

const CODESAMPLE_LANGUAGES = [
	{ text: "HTML/XML", value: "markup" },
	{ text: "CSS", value: "css" },
	{ text: "Javascript", value: "javascript" },
	{ text: "TypeScript", value: "typescript" },
	{ text: "Python", value: "python" },
	{ text: "Java", value: "java" },
	{ text: "C", value: "c" },
	{ text: "C++", value: "cpp" },
	{ text: "C#", value: "csharp" },
	{ text: "Go", value: "go" },
	{ text: "Rust", value: "rust" },
	{ text: "Ruby", value: "ruby" },
	{ text: "PHP", value: "php" },
	{ text: "Swift", value: "swift" },
	{ text: "Kotlin", value: "kotlin" },
	{ text: "SQL", value: "sql" },
	{ text: "Bash", value: "bash" },
	{ text: "JSON", value: "json" },
	{ text: "YAML", value: "yaml" },
	{ text: "Markdown", value: "markdown" },
	{ text: "Docker", value: "docker" },
	{ text: "Dart", value: "dart" },
	{ text: "Scala", value: "scala" },
	{ text: "Lua", value: "lua" },
	{ text: "R", value: "r" },
	{ text: "Elixir", value: "elixir" },
	{ text: "Erlang", value: "erlang" },
	{ text: "Haskell", value: "haskell" },
	{ text: "Perl", value: "perl" },
	{ text: "LaTeX", value: "latex" },
];

function TinyMCEEditor({ defaultValue, onChange }: TinyMCEEditorProps) {
	const editorRef = useRef<TinyMCEEditorInstance | null>(null);
	// Keep a ref to onChange so setup callbacks always use the latest version
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const { theme } = useTheme();

	const handleInit = useCallback((_evt: unknown, editor: TinyMCEEditorInstance) => {
		editorRef.current = editor;
		scheduleHashtagDetection(editor);
	}, []);

	const skinUrl = theme === "dark" ? "./tinymce/skins/ui/oxide-dark" : "./tinymce/skins/ui/oxide";

	const contentCss = theme === "dark" ? "./tinymce/skins/content/dark/content.min.css" : "./tinymce/skins/content/default/content.min.css";

	const contentStyle = THEME_CONTENT_STYLES[theme] || THEME_CONTENT_STYLES.light;

	const init = useMemo(
		() => ({
			plugins: ["preview", "searchreplace", "autolink", "autosave", "directionality", "visualblocks", "visualchars", "fullscreen", "image", "link", "media", "codesample", "table", "charmap", "pagebreak", "anchor", "insertdatetime", "advlist", "lists", "wordcount", "help", "emoticons"],
			menubar: false,
			toolbar:
				"undo redo removeformat | blocks fontsize bold italic strikethrough underline | forecolor backcolor | alignleft aligncenter alignright alignjustify | numlist bullist | outdent indent lineheight | charmap emoticons | fullscreen preview | image media link blockquote codesample | ltr rtl",
			statusbar: false,
			height: "100%",
			resize: false,
			language: "zh_CN",
			language_url: "./tinymce/langs/zh_CN.js",
			skin_url: skinUrl,
			content_css: contentCss,
			content_style: contentStyle,
			font_size_formats: "12px 14px 16px 18px 24px 36px 48px 56px 72px",
			codesample_languages: CODESAMPLE_LANGUAGES,
			promotion: false,
			branding: false,
			autosave_restore_when_empty: false,
			setup: (editor: TinyMCEEditorInstance) => {
				// Listen for every input event — onEditorChange only fires on TinyMCE's
				// internal 'change' event (undo stack updates, blur), not on every keystroke.
				editor.on("input", () => {
					onChangeRef.current?.(editor.getContent());
					scheduleHashtagDetection(editor);
				});

				// Also catch formatting commands (bold, italic, etc.) and undo/redo
				editor.on("ExecCommand Undo Redo", () => {
					onChangeRef.current?.(editor.getContent());
					scheduleHashtagDetection(editor);
				});

				// Ctrl+S: immediate save (bypasses the 500ms debounce)
				editor.addShortcut("meta+s", "Save note", () => {
					onChangeRef.current?.(editor.getContent());
				});

				// Handle image drops from filesystem (Electron-specific)
				editor.on("drop", async (e) => {
					const file = e.dataTransfer?.files[0];
					if (file?.type.startsWith("image/")) {
						e.preventDefault();
						e.stopPropagation();
						try {
							const buffer = await file.arrayBuffer();
							const src = await window.api.images.saveFromBuffer(buffer, file.type);
							editor.insertContent(`<img src="${src}" alt="" />`);
						} catch (err) {
							console.error("Failed to save dropped image:", err);
						}
					}
				});

				// Handle image paste
				editor.on("paste", async (e) => {
					const items = e.clipboardData?.items;
					if (!items) return;
					for (let i = 0; i < items.length; i++) {
						if (items[i].type.startsWith("image/")) {
							e.preventDefault();
							e.stopPropagation();
							const blob = items[i].getAsFile();
							if (!blob) continue;
							try {
								const buffer = await blob.arrayBuffer();
								const src = await window.api.images.saveFromBuffer(buffer, blob.type);
								editor.insertContent(`<img src="${src}" alt="" />`);
							} catch (err) {
								console.error("Failed to save pasted image:", err);
							}
							break;
						}
					}
				});
			},
			images_upload_handler: async (blobInfo: { blob: () => Blob }) => {
				const blob = blobInfo.blob();
				const buffer = await blob.arrayBuffer();
				const src = await window.api.images.saveFromBuffer(buffer, blob.type);
				return src;
			},
			automatic_uploads: true,
		}),
		[skinUrl, contentCss, contentStyle]
	);

	return (
		<div className="flex-1 flex flex-col overflow-hidden tinymce-wrapper">
			<Editor tinymceScriptSrc="./tinymce/tinymce.min.js" onInit={handleInit} initialValue={defaultValue} init={init} />
		</div>
	);
}

export default TinyMCEEditor;
