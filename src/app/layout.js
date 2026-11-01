
export const metadata = {
  title: "NS Designer API",
  description: "NS Designer Backend Server",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
