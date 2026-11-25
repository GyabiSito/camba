{{ $subject }}

{{-- Plain MIME: keep the buyer's name and the configured URLs literal. --}}
{!! $greeting !!}

Explorá la tienda: {!! $shopUrl !!}
@if (($supportEmail ?? null) || ($supportPhone ?? null))

Ayuda: {!! implode(' · ', array_filter([$supportEmail ?? null, $supportPhone ?? null])) !!}
@endif
