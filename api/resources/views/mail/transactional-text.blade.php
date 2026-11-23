Camba

{{ $title }}

{{ $intro }}
@foreach ($details ?? [] as $label => $value)

{{ $label }}: {{ $value }}
@endforeach

{{ $actionLabel }}:
{{-- Plain MIME needs the original URL, including literal query separators in signed links. --}}
{!! $actionUrl !!}
@foreach ($notes ?? [] as $note)

{{ $note }}
@endforeach
@if (($supportEmail ?? null) || ($supportPhone ?? null))

Ayuda: {{ implode(' · ', array_filter([$supportEmail ?? null, $supportPhone ?? null])) }}
@endif
