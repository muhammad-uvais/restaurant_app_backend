const QRCode = require("qrcode");

const generateQR = async (domain) => {
  if (!domain) throw new Error("Domain is required for QR generation");
  return await QRCode.toDataURL(`https://${domain}`);
};

module.exports = generateQR;