<?php

namespace App\Support\Homepage;

use App\Models\Category;
use App\Models\Product;

class DefaultHomepage
{
    public const BLOCKS = ['hero', 'categories', 'selection', 'look', 'story', 'mosaic'];

    public static function assets(): array
    {
        $sizes = [
            'hero-wide' => [1800, 782, 1100], 'hero-mobile' => [800, 1000, 480],
            'remeras' => [720, 480, 420], 'camisas' => [720, 480, 420], 'pantalones' => [720, 480, 420],
            'look' => [1200, 858, 720], 'story' => [768, 512, 480], 'weave' => [290, 290, 180],
            'finish' => [246, 246, 160], 'cierre-tela' => [1200, 1000, 600],
            'cierre-silueta' => [720, 480], 'cierre-trama' => [1320, 880],
        ];
        $assets = [];
        foreach ($sizes as $key => $size) {
            $url = '/demo-home/atelier-'.$key;
            $assets[$key] = ['url' => $url.'.webp', 'thumbnail_url' => $url.(isset($size[2]) ? '-small' : '').'.webp',
                'width' => $size[0], 'height' => $size[1]];
            if (isset($size[2])) {
                $assets[$key]['small_width'] = $size[2];
            }
        }

        return $assets;
    }

    public static function document(): array
    {
        $categories = Category::query()->where('active', true)->whereIn('slug', ['remeras', 'camisas', 'pantalones'])->get()->keyBy('slug');
        $image = fn (string $key, string $alt = '') => ['key' => $key, 'alt' => $alt, 'x' => null, 'y' => null];
        $catalog = fn (string $label) => ['type' => 'catalog', 'label' => $label];
        $categoryLink = fn (string $slug, string $label) => isset($categories[$slug])
            ? ['type' => 'category', 'id' => $categories[$slug]->id, 'label' => $label] : null;
        $cards = [];
        foreach (['remeras', 'camisas', 'pantalones'] as $slug) {
            if (isset($categories[$slug])) {
                $cards[] = ['categoryId' => $categories[$slug]->id, 'image' => $image($slug), 'label' => ''];
            }
        }
        $lookIds = [];
        foreach (['camisa-liviana-blanca', 'pantalon-pinzas-arena'] as $slug) {
            $id = Product::query()->published()->where('slug', $slug)->value('id');
            if ($id !== null) {
                $lookIds[] = $id;
            }
        }

        return [
            'order' => self::BLOCKS, 'hidden' => [],
            'hero' => ['desktop' => $image('hero-wide'), 'mobile' => $image('hero-mobile'), 'title' => 'Vestite distinto.',
                'text' => 'Ropa para combinar a tu manera.', 'primary' => $catalog('Ver tienda'),
                'secondary' => ['type' => 'section', 'section' => 'categories', 'label' => 'Explorá por categoría']],
            'categories' => ['mode' => $cards === [] ? 'automatic' : 'manual', 'cards' => $cards],
            'selection' => ['title' => 'Selección de Camba', 'action' => $catalog('Ver todo el catálogo'),
                'mode' => 'automatic', 'categoryId' => null, 'productIds' => []],
            'look' => ['title' => 'Armá el look', 'text' => 'Una camisa blanca y un pantalón arena: dos prendas para combinar juntas o por separado.',
                'image' => $image('look', 'Una camisa blanca y un pantalón arena en movimiento, en un taller iluminado por el sol.'),
                'mode' => 'automatic', 'productIds' => $lookIds],
            'story' => ['title' => 'Texturas y detalles', 'text' => 'La luz marca los pliegues de la camisa y el corte de un pantalón con pinzas.',
                'image' => $image('story', 'Una persona sentada junto al ventanal; la luz dibuja los pliegues de la ropa.'),
                'details' => [$image('weave', 'Detalle del paño blanco y de cómo cae la manga.'), $image('finish', 'Detalle de las pinzas y las costuras en la cintura arena.')],
                'action' => $categoryLink('camisas', 'Ver camisas')],
            'mosaic' => ['image' => $image('cierre-tela'), 'action' => $catalog('Ver catálogo'), 'tiles' => [
                ['image' => $image('remeras', 'Remera oscura puesta junto a un ventanal.'), 'action' => $categoryLink('remeras', 'Remeras')],
                ['image' => $image('cierre-silueta', 'Silueta sentada contra una pared ladrillo.'), 'action' => null],
                ['image' => $image('cierre-trama', 'Detalle de una sobrecamisa oliva sobre algodón oscuro.'), 'action' => null],
                ['image' => $image('camisas', 'Puño arremangado de una camisa clara.'), 'action' => $categoryLink('camisas', 'Camisas')],
                ['image' => $image('pantalones', 'Pantalón arena al caminar sobre madera.'), 'action' => $categoryLink('pantalones', 'Pantalones')],
                ['image' => $image('look', 'Camisa y pantalón en un look de cuerpo entero.'), 'action' => ['type' => 'section', 'section' => 'look', 'label' => 'Armá el look']],
            ]],
        ];
    }
}
