import { stderr, stdout } from "node:process";

export async function printTerminalQr(data: string, title?: string, stream: "stdout" | "stderr" = "stdout"): Promise<void> {
  const qr = await import("qrcode-terminal");
  const sink = stream === "stderr" ? stderr : stdout;
  if (title) {
    sink.write(`${title}\n`);
  }
  qr.generate(data, { small: true }, (rendered) => {
    sink.write(`${rendered}\n`);
  });
}
