
# AI Code Reviewer & Assistant

An intelligent code analysis and generation assistant powered by various AI models. Submit your code snippets, link to repositories, or describe what you need, and receive automated feedback, insights, suggested edits, or generated code.

## Features

- **Multiple AI Providers:**
    - Google Gemini (via API Key or `process.env.API_KEY`)
    - OpenAI (GPT models like GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo)
    - Groq (Llama3, Mixtral, Gemma models)
    - Ollama (local AI, with model discovery from your Ollama instance)
    - LM Studio (local AI, OpenAI-compatible server)
    - Other Local AI (any server exposing an OpenAI-compatible API)
- **Comprehensive AI Actions:**
    - **Code Review:** Get detailed feedback on code quality, best practices, potential issues, and suggestions.
    - **Code Insights:** Obtain high-level understanding of code purpose, key components, and notable patterns.
    - **Suggest Edits:** Receive AI-suggested modifications directly, with explanations, and apply them to the editor.
    - **Generate Code:** Describe the code you need in a chosen language, and the AI will generate it.
- **Flexible Input Modes:**
    - **Paste Code:** Directly paste your code snippets for analysis or generation.
    - **GitHub Repository:**
        - Browse public GitHub repositories, navigate folders.
        - Select individual files for review, insights, or edits.
        - Perform sequential analysis (review, insights, or edits) on multiple files within a repository.
    - **Google Cloud Storage (GCS):** Load and analyze code from publicly accessible GCS objects.
    - **Google Drive:** Load and analyze code from publicly shared Google Drive files.
- **User-Friendly Interface:**
    - Responsive two-panel layout (Controls & Inputs on the left, Outputs & Results on the right).
    - Scrollable and expandable Output Panel to manage extensive AI responses.
    - Dynamic UI that adapts to selected modes and actions.
    - Language selection for analysis and code generation.
    - "Clear Output" and "Download Code" functionalities.
- **Configuration & Management:**
    - **Settings Modal:**
        - Easily switch between AI providers.
        - Configure API keys, base URLs, and model names for each provider.
        - Select specific models for OpenAI and Groq.
        - Fetch and select available models from your local Ollama instance.
        - "Test Connection" feature to verify AI provider settings.
    - Settings are saved to your browser's local storage.
- **Accessibility:**
    - Keyboard navigation support.
    - ARIA attributes for dynamic content and interactive elements.

## Tech Stack

- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS
- **AI SDKs/APIs:**
    - `@google/genai` for Google Gemini
    - Direct `fetch` calls for OpenAI, Groq, Ollama, and other local OpenAI-compatible APIs.
- **Utilities:** `js-base64` (for GitHub file decoding)
- **Execution:** Runs directly in the browser using ES Modules and Import Maps (no build step required for basic usage).

## Setup & Installation

There are two main ways to run this application:

**1. Direct Browser Usage (Recommended for Simplicity):**

   No build step or `npm install` is required for this method.
   1. Ensure you have a modern web browser that supports ES Modules and Import Maps (e.g., latest Chrome, Firefox, Edge, Safari).
   2. Clone or download this repository.
   3. Serve the project's root directory using a simple HTTP server.
      - If you have Node.js installed, you can use `npx serve .` from the project root.
      - Alternatively, use any other local HTTP server tool (e.g., Python's `http.server`, Live Server extension in VS Code).
   4. Open `index.html` in your browser (e.g., `http://localhost:3000` if using `npx serve`).

**2. Using Node.js/npm (Optional, for Development/Bundling):**

   If you prefer to manage dependencies with npm/yarn or plan to integrate a build process (e.g., with Vite, Webpack):
   1. Ensure you have Node.js (v18 or newer recommended) and npm (or yarn) installed.
   2. Clone or download this repository.
   3. Navigate to the project root in your terminal.
   4. Install dependencies:
      ```bash
      npm install
      # or
      # yarn install
      ```
   5. You can then run the TypeScript checker:
      ```bash
      npm run build
      ```
   6. To run the application, you would still use a local HTTP server as described in method 1, or configure a development server provided by a bundler (e.g., `npm run dev` if using Vite, which would require further setup).

## Configuration

All AI provider configurations are managed via the **Settings Modal**, accessible by clicking the gear icon in the header.

- **API Keys:**
    - For cloud services (Gemini, OpenAI, Groq), you'll need to provide your own API keys.
    - For Gemini, if the `API_KEY` environment variable is set during a build/deployment process, it will be used as a fallback if no key is entered in the settings.
    - API keys are stored in your browser's local storage. **Be cautious when using this application on shared or public computers.**
- **Local AI Servers (Ollama, LM Studio, Other OpenAI-compatible):**
    - **Base URL:** Specify the full base URL where your local AI server is listening (e.g., `http://localhost:11434` for Ollama, `http://localhost:1234/v1` for LM Studio).
    - **Model Name:**
        - For Ollama: Enter the model tag (e.g., `llama3:latest`) or use the "Fetch & Select Ollama Models" button.
        - For LM Studio: Use the model identifier/path shown in the LM Studio server UI.
        - For other local servers: Use the model name expected by your server.
    - **CORS (Cross-Origin Resource Sharing): THIS IS CRITICAL!**
        - Your local AI server **must** be configured to allow requests from the origin where this web application is being served (e.g., `http://localhost:3000`).
        - **For Ollama:** Set the `OLLAMA_ORIGINS` environment variable (e.g., `OLLAMA_ORIGINS=*` for testing, or be more specific like `OLLAMA_ORIGINS=http://localhost:3000`). Restart Ollama after setting.
        - **For LM Studio:** CORS is usually enabled by default for `localhost` origins.
        - For other servers, consult their documentation on how to enable CORS.
        - Network errors during "Test Connection" or AI requests often point to CORS issues or the server not running/being accessible.
- **Model Selection:** For OpenAI and Groq, you can select from a list of popular models.

## Usage Instructions

1.  **Select Input Mode:**
    - **Paste Code:** Choose this to directly paste your code or type a description for code generation.
    - **GitHub Repo:** Enter a public GitHub repository URL (e.g., `https://github.com/owner/repo`).
    - **GCS Object:** Enter a public GCS object URL (e.g., `https://storage.googleapis.com/bucket/object.js`).
    - **Drive File:** Enter a public Google Drive shareable link.
2.  **Configure Source (if not Paste Code):**
    - For GitHub: Click "Load Repository Browser" or "Load Files for Scan".
        - **Browser Mode:** Navigate folders, click a file to load its content.
        - **Scan Mode:** Files will be listed for sequential analysis.
    - For GCS/Drive: Click "Load Object" or "Load File".
3.  **Select Action Type:**
    - **Review/Insights/Suggest Edits:** Available for all modes once code is loaded.
    - **Generate Code:** Available in "Paste Code" mode. The input area becomes your prompt.
    - **Sequential File Analysis (GitHub):** Select this action type before loading files for scan. Then choose the sub-action (Review, Insights, Suggest Edits) for each file in the sequence.
4.  **Select Language:**
    - For analysis: The language of the loaded code (often auto-detected).
    - For generation: The target language for the AI to generate.
5.  **Initiate AI Action:** Click the main action button (e.g., "Review Code," "Generate Code," "Analyze Next File").
6.  **View Results:**
    - AI feedback, insights, or generated code will appear in the right-hand Output Panel.
    - Use the Expand/Collapse button on the Output Panel to manage its size.
    - Use "Clear Output" to reset the output area.
    - For "Suggest Edits" or "Generate Code":
        - "Apply Edits" / "Load to Editor" buttons allow you to bring the AI's code into the main editor.
        - "Copy Code" buttons are available.
7.  **Download Code:** Use the "Download Code" button to save the current content of the editor or the last generated code.

## Contributing

Contributions are welcome! If you'd like to contribute, please feel free to fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the ISC License - see the `LICENSE` file (if one exists, or refer to `package.json`) for details.

---


