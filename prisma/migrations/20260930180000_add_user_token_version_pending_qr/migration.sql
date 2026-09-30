-- Revogação de JWT: o token carrega `tv` e só vale enquanto for igual a
-- "tokenVersion" (lib/auth.ts). Logout, troca e redefinição de senha
-- incrementam. Default 0: tokens emitidos antes desta migração não têm `tv`
-- e são lidos como versão 0, de modo que continuam válidos no deploy.
-- "pendingQrCodeId": QR code (QRCode.id) informado no cadastro; a matrícula
-- e o consumo da vaga passam para a verificação do email.
ALTER TABLE "User" ADD COLUMN     "pendingQrCodeId" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
