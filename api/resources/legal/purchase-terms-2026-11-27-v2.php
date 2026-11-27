<?php

// Published versions are immutable. Copy to a new dated file before changing the policy.
$change = new DateTimeImmutable('2027-01-01');
$period = 'Hasta el '.$change->modify('-1 day')->format('d/m/Y').', el plazo es de 5 días hábiles; desde el '
    .$change->format('d/m/Y').', es de 10 días corridos. En ambos casos se cuenta desde la contratación o la entrega, a tu elección.';

return [
    'version' => '2026-11-27-v2',
    'withdrawal_period' => $period,
    'withdrawal' => 'Podés dejar sin efecto la compra sin dar un motivo. '.$period.' '
        .'Comunicá tu decisión por el botón de arrepentimiento de Inicio, sin necesidad de iniciar sesión, o por otro medio que permita dejar constancia. El formulario devuelve una constancia con número y fecha, sin revelar si el pedido existe. La constancia registra la solicitud y no confirma por sí sola un reintegro. '
        .'Devolvé el producto sin uso y en el estado en que lo recibiste, salvo lo necesario para revisarlo. '
        .'Camba debe restituir inmediatamente todo lo que pagaste; si abonaste por Mercado Pago, Camba gestiona la devolución por ese medio. '
        .'Cada parte se hace cargo de devolver lo que recibió, con los costos que correspondan a esa devolución. '
        .'Si no te informamos este derecho por escrito, el plazo no empieza a correr en los términos de la ley.',
    'sections' => [
        ['title' => 'Compra, disponibilidad y precio', 'text' => 'Para comprar, iniciá sesión, elegí los productos y revisá el resumen. Ahí vas a ver los artículos, el costo de envío o retiro y el total final en pesos uruguayos (UYU), con los impuestos incluidos y el envío desglosado. Podés corregir los datos y las cantidades antes de confirmar. La preparación depende de la disponibilidad confirmada y de la acreditación del pago.'],
        ['title' => 'Pago por Mercado Pago', 'text' => 'El pago en línea se realiza por Mercado Pago. Antes de pagar vas a ver los medios habilitados para tu operación. Si elegís tarjeta, Camba configura un máximo de una cuota. Camba confirma el pago cuando Mercado Pago lo acredita. Si no se completa, consultá el estado antes de intentar otra vez.'],
        ['title' => 'Envío y retiro', 'text' => 'Antes de confirmar vas a ver las modalidades disponibles y el costo de envío por separado. Cuando el retiro está habilitado, no tiene costo. Para entrega, indicá los datos de quien recibe y la dirección. La tienda no publica un plazo único de preparación o entrega: contactanos para consultar por tu destino. Para retiro, esperá el aviso de que el pedido está listo.'],
        ['title' => 'Cambios voluntarios', 'text' => 'Podés pedir un cambio voluntario dentro de los 10 días hábiles siguientes a la recepción. Contactanos con la referencia para coordinarlo. Los cambios voluntarios no sustituyen el derecho de retracto ni limitan tus derechos si el producto tiene un defecto.'],
        ['title' => 'Garantías, defectos y reclamos', 'text' => 'Si el producto tiene un defecto, no coincide con lo ofrecido o hubo un problema con la entrega o el cobro, contactanos con la referencia y una descripción. Si se ofrece una garantía comercial, sus condiciones se informan por escrito. La garantía comercial y estos términos no limitan los derechos ni los plazos que te reconoce la ley. También podés acudir a Defensa del Consumidor.'],
    ],
];
