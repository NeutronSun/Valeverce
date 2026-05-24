import "./globals.css";

export const metadata = {
  title: "valeverce",
  description: "valeverce card game"
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
