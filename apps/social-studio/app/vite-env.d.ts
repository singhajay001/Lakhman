/// <reference types="vite/client" />

// Polaris ships a stylesheet that the app links rather than bundles. Vite's `?url`
// suffix has no type of its own outside a project that pulls in vite/client, and the
// repository-wide typecheck does not, so it is declared here.
declare module '*.css?url' {
  const url: string;
  export default url;
}
