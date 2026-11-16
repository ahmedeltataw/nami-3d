import { model, poster } from '../../assets/helpers';

export const s03Assets = {
  'station.1': lab('station_1_web', 99080),
  'station.2': lab('station_2_mobile', 47196),
  'station.3': lab('station_3_marketing', 153448),
  'station.4': lab('station_4_consulting', 120984),
  'station.5': lab('station_5_cloud', 215060),
  'station.6': lab('station_6_design', 154384),
  arms: lab('mechanical_arms', 244904),
  'poster:s03': poster('s03'),
} as const;

function lab(file: string, bytes: number) {
  return model(`/models/lab/${file}.glb`, bytes, ['s03']);
}
