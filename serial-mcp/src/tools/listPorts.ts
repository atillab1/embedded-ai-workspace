import { SerialPort } from "serialport";

export interface PortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
}

export async function listPorts(): Promise<PortInfo[]> {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    vendorId: p.vendorId,
    productId: p.productId,
    serialNumber: p.serialNumber,
  }));
}

export function formatPorts(ports: PortInfo[]): string {
  if (ports.length === 0) return "No serial ports detected.";
  const lines = ports.map((p) => {
    const tags: string[] = [];
    if (p.manufacturer) tags.push(`mfr=${p.manufacturer}`);
    if (p.vendorId && p.productId) tags.push(`vid:pid=${p.vendorId}:${p.productId}`);
    if (p.serialNumber) tags.push(`sn=${p.serialNumber}`);
    return `- ${p.path}  ${tags.join("  ")}`;
  });
  return `Found ${ports.length} port(s):\n${lines.join("\n")}`;
}
