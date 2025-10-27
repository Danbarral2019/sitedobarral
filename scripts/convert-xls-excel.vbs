' VBScript para converter .xls para .xlsx usando Excel
' Uso: cscript convert-xls-excel.vbs "caminho\arquivo.xls"

Option Explicit

' Constantes do Excel
Const xlOpenXMLWorkbook = 51 ' .xlsx format
Const xlExcel8 = 56 ' .xls format

Dim args, inputFile, outputFile
Dim fso, excel, workbook

' Pega argumentos
Set args = WScript.Arguments
If args.Count < 1 Then
    WScript.Echo "Uso: cscript convert-xls-excel.vbs ""caminho\arquivo.xls"""
    WScript.Quit 1
End If

inputFile = args(0)

' Cria FileSystemObject
Set fso = CreateObject("Scripting.FileSystemObject")

' Verifica se arquivo existe
If Not fso.FileExists(inputFile) Then
    WScript.Echo "ERRO: Arquivo nao encontrado: " & inputFile
    WScript.Quit 1
End If

' Define arquivo de saida
outputFile = fso.GetParentFolderName(inputFile) & "\" & _
             fso.GetBaseName(inputFile) & ".xlsx"

WScript.Echo "Convertendo XLS para XLSX..."
WScript.Echo "Input:  " & inputFile
WScript.Echo "Output: " & outputFile

On Error Resume Next

' Cria instancia do Excel
Set excel = CreateObject("Excel.Application")

If Err.Number <> 0 Then
    WScript.Echo "ERRO: Microsoft Excel nao encontrado"
    WScript.Echo "Por favor, converta manualmente no Excel:"
    WScript.Echo "  1. Abra o arquivo .xls no Excel"
    WScript.Echo "  2. Salvar Como > Excel 2007-365 (.xlsx)"
    WScript.Quit 1
End If

excel.Visible = False
excel.DisplayAlerts = False

' Abre arquivo
Set workbook = excel.Workbooks.Open(inputFile)

If Err.Number <> 0 Then
    WScript.Echo "ERRO ao abrir arquivo: " & Err.Description
    excel.Quit
    WScript.Quit 1
End If

' Salva como .xlsx
workbook.SaveAs outputFile, xlOpenXMLWorkbook

If Err.Number <> 0 Then
    WScript.Echo "ERRO ao salvar: " & Err.Description
    workbook.Close False
    excel.Quit
    WScript.Quit 1
End If

' Fecha
workbook.Close False
excel.Quit

' Limpa
Set workbook = Nothing
Set excel = Nothing
Set fso = Nothing

WScript.Echo ""
WScript.Echo "SUCESSO! Arquivo convertido:"
WScript.Echo outputFile
WScript.Echo ""
WScript.Echo "Proximos passos:"
WScript.Echo "1. Acesse http://localhost:3000/admin/tcu-converter"
WScript.Echo "2. Faca upload do arquivo .xlsx"
WScript.Echo "3. Baixe o arquivo convertido"
WScript.Echo "4. Importe em /admin/importar"
