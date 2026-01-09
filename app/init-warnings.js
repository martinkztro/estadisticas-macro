// Suppress Ant Design React 19 compatibility warning
if (typeof globalThis !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;

  const isAntdWarning = (args) => {
    if (!args || !args.length) return false;
    
    const message = args[0]?.toString?.() || "";
    const lowercaseMsg = message.toLowerCase();
    
    return (
      lowercaseMsg.includes("antd") ||
      lowercaseMsg.includes("react is 16") ||
      lowercaseMsg.includes("compatible") ||
      lowercaseMsg.includes("[antd:") ||
      lowercaseMsg.includes("v5 support react") ||
      message.includes("antd v5") ||
      message.includes("for-react-19")
    );
  };

  globalThis.console.warn = function (...args) {
    if (!isAntdWarning(args)) {
      originalWarn.apply(console, args);
    }
  };

  globalThis.console.error = function (...args) {
    if (!isAntdWarning(args)) {
      originalError.apply(console, args);
    }
  };

  // Interceptar warnings de React también
  if (typeof window !== "undefined") {
    const originalReactWarn = window.__REACT_DEVTOOLS_CONSOLE_FUNCTIONS__?.warn;
    if (originalReactWarn) {
      window.__REACT_DEVTOOLS_CONSOLE_FUNCTIONS__.warn = function (...args) {
        if (!isAntdWarning(args)) {
          originalReactWarn.apply(console, args);
        }
      };
    }
  }
}
