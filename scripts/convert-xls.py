# -*- coding: utf-8 -*-
"""
Script para converter arquivos .xls antigos para .xlsx

Instalacao:
    pip install pandas xlrd openpyxl

Uso:
    python convert-xls.py "caminho/arquivo.xls"
"""

import sys
import os
from pathlib import Path

print("Verificando dependencias...")

try:
    import pandas as pd
    print("OK: pandas encontrado")
except ImportError:
    print("ERRO: pandas nao instalado")
    print("Execute: pip install pandas xlrd openpyxl")
    sys.exit(1)

def convert_file(input_path):
    """Converte arquivo .xls para .xlsx"""

    input_file = Path(input_path)

    if not input_file.exists():
        print(f"ERRO: Arquivo nao encontrado: {input_path}")
        sys.exit(1)

    # Define arquivo de saida
    output_file = input_file.with_suffix('.xlsx')

    print(f"\nLendo arquivo: {input_file.name}")

    # Le o arquivo .xls
    try:
        df = pd.read_excel(input_path, engine='xlrd')
        print(f"OK: {len(df)} linhas, {len(df.columns)} colunas")
    except Exception as e:
        print(f"ERRO ao ler: {e}")
        print("\nTentando com openpyxl...")
        try:
            df = pd.read_excel(input_path, engine='openpyxl')
            print(f"OK: {len(df)} linhas, {len(df.columns)} colunas")
        except Exception as e2:
            print(f"ERRO: {e2}")
            sys.exit(1)

    # Mostra as colunas
    print("\nColunas encontradas:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i}. {col}")

    # Mostra primeiras linhas
    print("\nPrimeiras 3 linhas:")
    print(df.head(3))

    # Escreve arquivo .xlsx
    print(f"\nSalvando como: {output_file.name}")
    df.to_excel(output_file, index=False, engine='openpyxl')

    print(f"\nSUCESSO! Arquivo salvo em:")
    print(str(output_file.absolute()))

    return str(output_file)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python convert-xls.py <arquivo.xls>")
        print("\nExemplo:")
        print('  python convert-xls.py "C:\\Users\\Admin\\Downloads\\pesquisaExportada (4).xls"')
        sys.exit(1)

    input_file = sys.argv[1]
    convert_file(input_file)
