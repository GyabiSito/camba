<!doctype html>
<html lang="es-UY">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject }}</title>
    <style>
        @media only screen and (max-width: 420px) {
            .welcome-hero { padding: 32px 22px !important; }
            .welcome-title { font-size: 33px !important; }
            .welcome-body { padding: 28px 24px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background:#F6F0E8;color:#24201E;font:16px/1.6 Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#F6F0E8">
    <tr><td align="center" style="padding:20px 12px 30px;">
        <!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
            <tr>
                <td class="welcome-hero" align="center" bgcolor="#F5E5E8" style="padding:38px 40px 40px;border-bottom:1px solid #E8DEDA;background:#F5E5E8;color:#720F12;">
                    <img src="{{ $message->embed(resource_path('mail/camba-bow.png')) }}" width="54" height="32" alt="" style="display:block;margin:0 auto 16px;border:0;">
                    <h1 class="welcome-title" style="max-width:470px;margin:0 auto;color:#720F12;font:normal 42px/1.13 Georgia,'Times New Roman',serif;letter-spacing:-0.7px;">{{ $subject }}</h1>
                </td>
            </tr>
            <tr>
                <td class="welcome-body" bgcolor="#FCFAF6" style="padding:34px 40px 36px;border:1px solid #E8DEDA;border-top:0;background:#FCFAF6;color:#24201E;">
                    <p style="margin:0 0 26px;color:#24201E;font:16px/1.65 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;">{{ $greeting }}</p>
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                        <tr><td bgcolor="#821F40" style="border-radius:4px;">
                            <a href="{{ $shopUrl }}" style="display:inline-block;padding:11px 19px;border:1px solid #821F40;border-radius:4px;background:#821F40;color:#FCFAF6;font:bold 16px/1.4 Arial,Helvetica,sans-serif;text-decoration:none;">Explorá la tienda</a>
                        </td></tr>
                    </table>
                    @if (($supportEmail ?? null) || ($supportPhone ?? null))
                        <p style="margin:28px 0 0;padding-top:14px;border-top:1px solid #E8DEDA;color:#635956;text-align:center;font:14px/1.5 Arial,Helvetica,sans-serif;">
                            Ayuda:
                            @if ($supportEmail ?? null)
                                <a href="mailto:{{ $supportEmail }}" style="color:#720F12;text-decoration:underline;overflow-wrap:anywhere;">{{ $supportEmail }}</a>
                            @endif
                            @if (($supportEmail ?? null) && ($supportPhone ?? null)) · @endif
                            @if ($supportPhone ?? null) {{ $supportPhone }} @endif
                        </p>
                    @endif
                </td>
            </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
</table>
</body>
</html>
