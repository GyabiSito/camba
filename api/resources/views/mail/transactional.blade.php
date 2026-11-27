<!doctype html>
<html lang="es-UY">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
    <style>
        @media only screen and (max-width: 420px) {
            .mail-gutter { padding-right: 18px !important; padding-left: 18px !important; }
            .mail-title { font-size: 32px !important; line-height: 1.15 !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background:#FCFAF6;color:#24201E;font:16px/1.6 Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#FCFAF6">
    <tr><td align="center" style="padding:20px 10px 32px;">
        <!--[if mso]><table role="presentation" width="580" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
            <tr><td class="mail-gutter" style="padding:8px 28px 16px;border-bottom:1px solid #E8DEDA;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                    <tr>
                        <td valign="middle" style="padding-right:11px;">
                            <img src="{{ $message->embed(resource_path('mail/camba-bow.png')) }}" width="38" height="22" alt="" style="display:block;border:0;">
                        </td>
                        <td valign="middle" style="color:#720F12;font:bold 25px/1.2 Georgia,'Times New Roman',serif;">Camba</td>
                    </tr>
                </table>
            </td></tr>
            <tr><td class="mail-gutter" style="padding:34px 28px 28px;color:#24201E;font:16px/1.6 Arial,Helvetica,sans-serif;@isset($contactMessage)background:#FFFFFF;border:1px solid #E8DEDA;border-radius:14px;@endisset">
                <h1 class="mail-title" style="margin:0 0 14px;color:#24201E;font:normal 40px/1.12 Georgia,'Times New Roman',serif;letter-spacing:-0.7px;">{{ $title }}</h1>
                <p style="margin:0 0 22px;">{{ $intro }}</p>
                @if (!empty($details))
                    <table width="100%" cellspacing="0" cellpadding="0" aria-label="{{ isset($contactMessage) ? 'Datos de contacto' : 'Datos del pedido' }}" style="margin:0 0 24px;border-collapse:collapse;font:15px/1.4 Arial,Helvetica,sans-serif;">
                        @foreach ($details as $label => $value)
                            <tr>
                                <th scope="row" align="left" style="padding:10px 12px 10px 0;border-top:1px solid #E8DEDA;color:#635956;font-weight:normal;">{{ $label }}</th>
                                <td align="right" style="padding:10px 0;border-top:1px solid #E8DEDA;color:#24201E;font-weight:bold;overflow-wrap:anywhere;">{{ $value }}</td>
                            </tr>
                        @endforeach
                    </table>
                @endif
                @isset($contactMessage)
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                        <tr><td bgcolor="#FCFAF6" style="padding:16px 18px;border:1px solid #E8DEDA;border-radius:6px;">
                            <h2 style="margin:0 0 8px;color:#720F12;font:bold 16px/1.4 Arial,Helvetica,sans-serif;">Mensaje</h2>
                            <p style="margin:0;word-break:break-word;overflow-wrap:anywhere;">{!! nl2br(e($contactMessage), false) !!}</p>
                        </td></tr>
                    </table>
                @endisset
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                    <tr><td bgcolor="#821F40" style="border-radius:4px;">
                        <a href="{{ $actionUrl }}" style="display:inline-block;padding:11px 19px;border:1px solid #821F40;border-radius:4px;background:#821F40;color:#FCFAF6;font:bold 16px/1.4 Arial,Helvetica,sans-serif;text-decoration:none;">{{ $actionLabel }}</a>
                    </td></tr>
                </table>
                @foreach ($notes ?? [] as $note)
                    <p style="margin:0 0 8px;">{{ $note }}</p>
                @endforeach
                @isset($contractUrl)
                    <p><a href="{{ $contractUrl }}" style="color:#720F12;">Guardá las condiciones de tu compra</a></p>
                @endisset
            </td></tr>
            <tr><td class="mail-gutter" style="padding:17px 28px 0;border-top:1px solid #E8DEDA;color:#635956;font:14px/1.55 Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 4px;">{{ isset($contactMessage) ? 'Si el botón no funciona, escribile a este correo:' : 'Si el botón no funciona, copiá y pegá este enlace en tu navegador:' }}</p>
                <p style="margin:0 0 16px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{ $actionUrl }}" style="color:#720F12;text-decoration:underline;word-break:break-all;">{{ isset($contactMessage) ? $details['Correo'] : $actionUrl }}</a></p>
                @if (($supportEmail ?? null) || ($supportPhone ?? null))
                    <p style="margin:0 0 8px;">
                        Ayuda:
                        @if ($supportEmail ?? null)
                            <a href="mailto:{{ $supportEmail }}" style="color:#720F12;text-decoration:underline;overflow-wrap:anywhere;">{{ $supportEmail }}</a>
                        @endif
                        @if (($supportEmail ?? null) && ($supportPhone ?? null)) · @endif
                        @if ($supportPhone ?? null) {{ $supportPhone }} @endif
                    </p>
                @endif
                <p style="margin:0;color:#720F12;">Camba</p>
            </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
</table>
</body>
</html>
