import "./globals.css";

export const metadata = {
  title: "Valeverce",
  description: "Valerio card game"
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
