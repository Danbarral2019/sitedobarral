#!/usr/bin/env python3
"""
Script para converter arquivos .xls antigos (CFB) para .xlsx
Usa pandas + xlrd para ler .xls e openpyxl para escrever .xlsx

Instalação:
    pip install pandas xlrd openpyxl

Uso:
    python convert-xls-to-xlsx.py "caminho/arquivo.xls"
"""

import sys
import os
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("❌ Erro: pandas não instalado")
    print("Execute: pip install pandas xlrd openpyxl")
    sys.exit(1)

def convert_xls_to_xlsx(input_path: str) -> str:
    """
    Converte arquivo .xls para .xlsx

    Args:
        input_path: Caminho do arquivo .xls

    Returns:
        Caminho do arquivo .xlsx gerado
    """

    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    if input_file.suffix.lower() not in ['.xls', '.xlsx']:
        raise ValueError("Arquivo deve ser .xls ou .xlsx")

    # Define arquivo de saída
    output_file = input_file.with_suffix('.xlsx')
    if input_file.suffix.lower() == '.xlsx':
        output_file = input_file.with_stem(f"{input_file.stem}_converted")

    print(f"📊 Lendo arquivo: {input_file.name}")

    # Lê o arquivo .xls
    try:
        # Tenta ler com xlrd (para .xls)
        df = pd.read_excel(input_path, engine='xlrd')
    except Exception as e:
        print(f"⚠️  Erro ao ler com xlrd: {e}")
        print("🔄 Tentando com openpyxl...")
        try:
            df = pd.read_excel(input_path, engine='openpyxl')
        except Exception as e2:
            print(f"❌ Erro ao ler arquivo: {e2}")
            raise

    print(f"✅ Leitura concluída: {len(df)} linhas, {len(df.columns)} colunas")

    # Mostra as colunas
    print(f"\n📝 Colunas encontradas:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")

    # Mostra primeiras linhas
    print(f"\n📄 Primeiras 3 linhas:")
    print(df.head(3).to_string())

    # Escreve arquivo .xlsx
    print(f"\n💾 Salvando como: {output_file.name}")
    df.to_excel(output_file, index=False, engine='openpyxl')

    print(f"✅ Conversão concluída!")
    print(f"📂 Arquivo salvo em: {output_file.absolute()}")

    return str(output_file)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python convert-xls-to-xlsx.py <arquivo.xls>")
        print("\nExemplo:")
        print('  python convert-xls-to-xlsx.py "C:\\Users\\Admin\\Downloads\\pesquisaExportada (4).xls"')
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        output_file = convert_xls_to_xlsx(input_file)
        print(f"\n🎉 Sucesso! Use o arquivo: {output_file}")
        print(f"\n📌 Próximos passos:")
        print(f"1. Acesse http://localhost:3000/admin/tcu-converter")
        print(f"2. Faça upload do arquivo: {Path(output_file).name}")
        print(f"3. Baixe o arquivo convertido")
        print(f"4. Importe em /admin/importar")
    except Exception as e:
        print(f"\n❌ Erro na conversão: {e}")
        sys.exit(1)
