Camba

{{ $title }}

{{-- This view is plain MIME: a buyer name must not turn into HTML entities. --}}
{!! $intro !!}
@foreach ($details ?? [] as $label => $value)

@if (isset($contactMessage))
{{ $label }}: {!! $value !!}
@else
{{ $label }}: {{ $value }}
@endif
@endforeach
@isset($contactMessage)

Mensaje:
{!! $contactMessage !!}
@endisset

{{ $actionLabel }}:
{{-- Plain MIME needs the original URL, including literal query separators in signed links. --}}
{!! $actionUrl !!}
@foreach ($notes ?? [] as $note)

{{ $note }}
@endforeach
@isset($contractUrl)

Condiciones de tu compra: {!! $contractUrl !!}
@endisset
@if (($supportEmail ?? null) || ($supportPhone ?? null))

Ayuda: {{ implode(' · ', array_filter([$supportEmail ?? null, $supportPhone ?? null])) }}
@endif
