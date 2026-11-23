<?php

namespace App\Http\Requests\Homepage;

use App\Models\HomepageImage;
use App\Support\Homepage\DefaultHomepage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveHomepageRequest extends RevisionRequest
{
    public function rules(): array
    {
        $rules = parent::rules() + [
            'document' => ['required', 'array:order,hidden,hero,categories,selection,look,story,mosaic'],
            'document.order' => ['required', 'list', 'size:6'],
            'document.order.*' => ['required', Rule::in(DefaultHomepage::BLOCKS), 'distinct'],
            'document.hidden' => ['present', 'list', 'max:6'],
            'document.hidden.*' => ['required', Rule::in(DefaultHomepage::BLOCKS), 'distinct'],
            'document.hero' => ['required', 'array:desktop,mobile,title,text,primary,secondary'],
            'document.categories' => ['required', 'array:mode,cards'],
            'document.categories.mode' => ['required', Rule::in(['manual', 'automatic'])],
            'document.categories.cards' => ['present', 'list', 'max:12'],
            'document.categories.cards.*' => ['required', 'array:categoryId,image,label'],
            'document.categories.cards.*.categoryId' => ['required', 'integer', 'distinct', 'exists:categories,id'],
            'document.categories.cards.*.label' => ['present', 'nullable', 'string', 'max:120'],
            'document.selection' => ['required', 'array:title,action,mode,categoryId,productIds'],
            'document.selection.categoryId' => ['present', 'nullable', 'integer', 'exists:categories,id'],
            'document.look' => ['required', 'array:title,text,image,mode,productIds'],
            'document.story' => ['required', 'array:title,text,image,details,action'],
            'document.story.details' => ['present', 'list', 'max:2'],
            'document.mosaic' => ['required', 'array:image,action,tiles'],
            'document.mosaic.tiles' => ['present', 'list', 'max:6'],
            'document.mosaic.tiles.*' => ['required', 'array:image,action'],
        ];
        foreach (['hero', 'selection', 'look', 'story'] as $block) {
            $rules["document.$block.title"] = ['required', 'string', 'max:160'];
        }
        foreach (['hero', 'look', 'story'] as $block) {
            $rules["document.$block.text"] = ['present', 'nullable', 'string', 'max:1200'];
        }
        foreach (['selection', 'look'] as $block) {
            $rules["document.$block.mode"] = ['required', Rule::in(['manual', 'automatic'])];
            $rules["document.$block.productIds"] = ['present', 'list', 'max:12'];
            $rules["document.$block.productIds.*"] = ['required', 'integer', 'distinct', 'exists:products,id'];
        }
        $keys = array_merge(array_keys(DefaultHomepage::assets()), HomepageImage::query()->pluck('key')->all());
        foreach (['hero.desktop', 'hero.mobile', 'categories.cards.*.image', 'look.image', 'story.image', 'story.details.*', 'mosaic.image', 'mosaic.tiles.*.image'] as $path) {
            $rules['document.'.$path] = ['present', $path === 'mosaic.tiles.*.image' ? 'required' : 'nullable', 'array:key,alt,x,y', 'required_array_keys:key,alt'];
            $rules['document.'.$path.'.key'] = ['required_with:document.'.$path, 'string', Rule::in($keys)];
            $rules['document.'.$path.'.alt'] = ['sometimes', 'nullable', 'string', 'max:300'];
            foreach (['x', 'y'] as $axis) {
                $rules['document.'.$path.'.'.$axis] = ['sometimes', 'nullable', 'numeric', 'between:0,100'];
            }
        }
        foreach (['hero.primary', 'hero.secondary', 'selection.action', 'story.action', 'mosaic.action', 'mosaic.tiles.*.action'] as $path) {
            $rules['document.'.$path] = ['present', 'nullable', 'array:type,label,id,section'];
            $rules['document.'.$path.'.type'] = ['required_with:document.'.$path, Rule::in(['catalog', 'category', 'product', 'section'])];
            $rules['document.'.$path.'.label'] = ['required_with:document.'.$path, 'string', 'max:120'];
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $inspect = function (mixed $node, string $path) use (&$inspect, $validator): void {
                if (! is_array($node)) {
                    return;
                }
                if (isset($node['type'])) {
                    $type = $node['type'];
                    $idType = in_array($type, ['category', 'product'], true);
                    if ($idType) {
                        $table = $type === 'category' ? 'categories' : 'products';
                        if (! isset($node['id']) || ! is_int($node['id']) || ! DB::table($table)->where('id', $node['id'])->exists()) {
                            $validator->errors()->add($path.'.id', 'Seleccioná un destino existente.');
                        }
                    } elseif (array_key_exists('id', $node)) {
                        $validator->errors()->add($path.'.id', 'Este destino no admite un identificador.');
                    }
                    if ($type === 'section' && ! in_array($node['section'] ?? null, DefaultHomepage::BLOCKS, true)) {
                        $validator->errors()->add($path.'.section', 'Seleccioná una sección válida.');
                    } elseif ($type !== 'section' && array_key_exists('section', $node)) {
                        $validator->errors()->add($path.'.section', 'Este destino no admite una sección.');
                    }
                }
                foreach ($node as $key => $child) {
                    $inspect($child, $path.'.'.$key);
                }
            };
            $inspect($this->input('document'), 'document');
        });
    }
}
