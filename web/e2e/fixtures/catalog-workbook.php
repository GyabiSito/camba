<?php

// Synthetic XLSX for the browser upload test. No app bootstrap or database access.
$path = tempnam(sys_get_temp_dir(), 'camba-xlsx-');
if ($path === false) {
    throw new RuntimeException('Could not allocate the XLSX fixture.');
}

try {
    $zip = new ZipArchive;
    if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Could not open the XLSX fixture.');
    }

    $sheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    $document = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    $package = 'http://schemas.openxmlformats.org/package/2006/relationships';
    $zip->addFromString('[Content_Types].xml', <<<'XML'
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        </Types>
        XML);
    $zip->addFromString('_rels/.rels', "<Relationships xmlns=\"$package\"><Relationship Id=\"rId1\" Type=\"$document/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
    $zip->addFromString('xl/workbook.xml', "<workbook xmlns=\"$sheet\" xmlns:r=\"$document\"><sheets><sheet name=\"Catalog\" r:id=\"rId1\"/></sheets></workbook>");
    $zip->addFromString('xl/_rels/workbook.xml.rels', "<Relationships xmlns=\"$package\"><Relationship Id=\"rId1\" Type=\"$document/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");

    $headers = ['codigo', 'nombre', 'precio_uyu', 'stock', 'categoria', 'marca', 'descripcion', 'fotos'];
    $row = '<row r="1">';
    foreach ($headers as $index => $name) {
        $row .= '<c r="'.chr(65 + $index).'1" t="inlineStr"><is><t>'.$name.'</t></is></c>';
    }
    $row .= '</row><row r="2"><c r="A2" t="inlineStr"><is><t>BROWSER-XLSX-001</t></is></c>'
        .'<c r="B2" t="inlineStr"><is><t>Planilla de prueba</t></is></c><c r="C2"><v>109.45</v></c>'
        .'<c r="D2"><v>2</v></c><c r="E2" t="inlineStr"><is><t>remeras</t></is></c></row>';
    $zip->addFromString('xl/worksheets/sheet1.xml', "<worksheet xmlns=\"$sheet\"><sheetData>$row</sheetData></worksheet>");
    if (! $zip->close() || readfile($path) === false) {
        throw new RuntimeException('Could not write the XLSX fixture.');
    }
} finally {
    unlink($path);
}
