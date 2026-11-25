<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Normalizer;

class GeographySeeder extends Seeder
{
    public function run(): void
    {
        $directory = json_decode(file_get_contents(database_path('data/countries.json')), true, flags: JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($directory): void {
            foreach ($directory as $department) {
                $id = $department['id'];
                DB::table('departments')->upsert([['id' => $id, 'name' => $department['name']]], ['id'], ['name']);

                $localities = array_map(static fn (array $town) => [
                    'department_id' => $id, 'source_id' => $town['id'], 'name' => $town['name'],
                ], $department['towns']);
                foreach (array_chunk($localities, 200) as $batch) {
                    DB::table('localities')->upsert($batch, ['department_id', 'source_id'], ['name']);
                }
            }

            $this->backfillAddresses();
        });
    }

    private function backfillAddresses(): void
    {
        $departments = DB::table('departments')->get(['id', 'name'])
            ->groupBy(static fn (object $department) => self::normalized($department->name));
        $localities = DB::table('localities')->get(['id', 'department_id', 'name'])
            ->groupBy(['department_id', static fn (object $locality) => self::normalized($locality->name)]);

        DB::table('addresses')->whereNull('locality_id')->select('id', 'department', 'locality')
            ->eachById(static function (object $address) use ($departments, $localities): void {
                $department = $departments->get(self::normalized($address->department));
                if ($department?->count() !== 1) {
                    return;
                }

                $locality = $localities->get($department->first()->id)?->get(self::normalized($address->locality));
                if ($locality?->count() === 1) {
                    DB::table('addresses')->where('id', $address->id)->whereNull('locality_id')
                        ->update(['locality_id' => $locality->first()->id]);
                }
            });
    }

    private static function normalized(string $name): string
    {
        $decomposed = Normalizer::normalize($name, Normalizer::FORM_D);

        return Str::lower(Str::squish(preg_replace('/\p{M}+/u', '', $decomposed)));
    }
}
